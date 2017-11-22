var fs = require('fs');
var ejs = require('ejs');
var http = require('http');
var url = require('url');
var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('./dbconfig.js');
var cron = require('node-schedule');
var rule2 = new cron.RecurrenceRule();
rule2.dayOfWeek = [0,1,2,3,4,5,6];
rule2.hour = 0;
rule2.minute = 0;

/**************************** ORACLE DB 연동 설정 ***********************************/
var login = { user : dbConfig.user, password: dbConfig.password, connectString : dbConfig.connectString };
function doRelease(connection)
{
  connection.release(
      function(err) {
        if (err) {
          console.err(err.message);
        }
      });
}
oracledb.outFormat = oracledb.OBJECT;
/*************************************************************************************/
var app = express();
var path = process.cwd();
app.use(express.cookieParser());
app.use(express.session({ secret: 'dbproject' }));
app.use(express.bodyParser());
app.use(express.logger('dev'));
app.use(express.static(__dirname +'/public'));
app.use(app.router);
/***********************************function**************************************/
cron.scheduleJob(rule2, function() {
  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( 
        "UPDATE MEMBER SET ISDELAY = 1 WHERE M_NUM IN (SELECT M_NUM FROM BORROW WHERE TO_NUMBER(TO_CHAR(R_DATE, 'YYYYMMDD')) < TO_NUMBER(TO_CHAR(SYSDATE, 'ddmmyyyy')))",
        function (err) {
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            console.log("update");
          })
        });
    }); 
   
});
/****************************** 메인 페이지 *************************************/
app.get('/index', function(request, response) {
  console.log("test1" + request.session.user_id);
  fs.readFile('./public/index.html', 'utf8', function(error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( "SELECT * FROM JOB WHERE J_NUM > 0",
          function (err, result)
          {
            var results = result.rows;
            console.log(results);
            response.send(ejs.render(data,
                { 
                  data: results,
                  user_id: request.session.user_id,
                  delay : request.session.delay,
                  user_name: request.session.user_name,
                  dp : 0 
                }));
            console.log(results);
            doRelease(connection);
          });
      });

  }); 
});

app.get('/mypage', function(request, response) {
  if(request.session.user_id){
  fs.readFile('./public/mypage.html', 'utf8', function(error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( 
          "SELECT A.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중','반납완료') as ISRETURN, C.IDX FROM CATEGORY A, BOOK B, BORROW C WHERE (C.M_NUM = :m_num) AND (B.B_NUM = C.B_NUM) AND (A.C_NUM = B.B_KIND)",
          [request.session.user_id],
          function (err, result)
          {
            var results = result.rows;
            console.log(results);
            response.send(ejs.render(data,
                { 
                  data: results,
                  user_id: request.session.user_id,
                  delay : request.session.delay
                }));
            console.log(results);
            doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다.");location.href="/index";</script>');
  }
});
app.post('/mypage', function (request, response) {
  var body = request.body;
  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "UPDATE BORROW SET R_DATE = R_DATE + 7 WHERE IDX = :idx and TO_NUMBER(TO_CHAR(R_DATE, 'ddmmyyyy')) >= TO_NUMBER(TO_CHAR(SYSDATE, 'ddmmyyyy'))",
        [body.idx],
        function (err) {
          if(err) { console.log(err.message); 
            response.send("<script>alert('연장기간이 지났습니다.');history.back();</script>");
            return; }
            connection.commit(function(err){
              if(err) { console.log(err.message); 
                response.send("<script>alert('연장기간이 지났습니다.');history.back();</script>");
                return; }
                response.send("<script>alert('연장되었습니다');location.href='/mypage';</script>");
            })
        });
    }); 
});

app.post('/result', function(request,response) {
  var body = request.body;
  var id = Number(body.s_option);
  var display = Number(body.s_display);
  console.log('result user+ide'+ request.session.user_id);
  var s_content = '%' + body.s_content + '%';
  function query(id) {
    var query1;
    if(id == 1) {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and b.B_NAME LIKE :ID";
    } else if(id == 2) {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and b.AUTHOR LIKE :ID";
    } else if(id == 3) { 
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and b.PUBLISHER LIKE :ID";
    } else if(id == 5) {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and (b.PUBLISHER LIKE :ID OR b.AUTHOR LIKE :ID OR b.B_NAME LIKE :ID OR c.C_NAME LIKE :ID)";
    } else {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and c.C_NAME LIKE :ID";
    }
    return query1;
  }
  console.log(query(id));
  /*oracledb.getConnection( login,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute(
        SELECT * FROM CATEGORY,
        where,
        function(err, result)
        {
          console.log(result);
          var results = result.rows;
          response.send(ejs.render(data,
              {
                data : results,
            dp : 1,
            user_id : request.session.user_id,
            delay : request.session.delay
              }));
          //response.send('<script>location.href="#result";<script>');
          doRelease(connection);
        });
    });*/

  fs.readFile('./public/index.html', 'utf8', function (error, data) {
    oracledb.getConnection( login,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          query(id),
          [s_content],
          function(err, result)
          {
            console.log(result);
            var results = result.rows;
            response.send(ejs.render(data,
                {
                  data : results,
              dp : 1,
              user_id : request.session.user_id,
              user_name: request.session.user_name,
              delay : request.session.delay
                }));
            //response.send('<script>location.href="#result";<script>');
            doRelease(connection);
          });
      });
  });
});

app.post('/check', function (request, response) {
  if(request.session.user_id && (request.session.delay == 0)) {
  var body = request.body;
  var current_id = Number(request.session.user_id);
  console.log("bnum"+body.b_num);
  console.log("current_id"+current_id);
  console.log("ischeck:" + body.b_num);
  oracledb.getConnection( login ,
    function(err, connection) {
      if (err) { console.error(err.message); return; }
      connection.execute( "INSERT INTO BORROWCHECK (M_NUM, B_NUM) VALUES (:m_num, :b_num)",
        [current_id, body.b_num],
        function (err) {
          if(err) { console.log(err.message); 
            response.send('<script>alert("이미 대출 신청중인 책입니다.");history.back();</script>');
            return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.send('<script>alert("대출신청되었습니다");history.back();</script>');
          })
        });
    });
  } else if(request.session.user_id && (request.session.delay == 1)){
    response.send('<script>alert("연체중입니다");history.back();</script>');
  } else {
    response.send('<script>alert("로그인이 필요합니다.");history.back();</script>');
  }
});
/*****************************메인 로그인 ******************/
app.post('/login', function(request, response) {
  console.log(request.body);
  var body = request.body;
  var m_num;
  var isdelay;
  oracledb.createPool (
    {
    user          : dbConfig.user,
    password      : dbConfig.password,
    connectString : dbConfig.connectString,
    poolMax       : 4, // maximum size of the pool
    poolMin       : 0, // let the pool shrink completely
    poolIncrement : 1, // only grow the pool by one connection at a time
    poolTimeout   : 0  // never terminate idle connections
    },
    function(err, pool)
    {
      if(err) { console.error("createPool() callback:" + err.message); return; }

      pool.getConnection(
        function(err, connection)
        {
          if(err) {handleError(response, "getConnection() failed ", err); return; }
          connection.execute(
            "SELECT M_NUM, ISDELAY, M_NAME FROM MEMBER WHERE M_NUM = :ID AND PWD = :PWD",
            [body.st_num, body.password],
            function(err,result)
            {
              if(err) { connection.release (
                function(err) {
                  if (err) {
                    handleError(response, "execute() error release() callback", err);
                    return;
                  }
                });
              handleError(response, "execute() callback", err);
              return;
              }
              //displayResults(response, result, deptid);
              console.log(typeof result.rows[0]);
              if(typeof result.rows[0] == "undefined"){
                response.send('<script>alert("아이디나 비밀번호가 틀립니다.");history.back();</script>');
              } else {
                m_num = result.rows[0].M_NUM;
                isdelay = result.rows[0].ISDELAY;
                request.session.user_id = m_num;
                request.session.delay = isdelay;
                request.session.user_name = result.rows[0].M_NAME;
                console.log(request.session.user_id);
                console.log(request.session.delay);
                response.send('<script>alert("로그인되었습니다!.");location.href="/index";</script>');
              } 
              connection.release(
                function(err)
                {
                  if(err) { 
                    handleError(response, "normal release() callback", err); 
                    return; 
                  }
                });
            });
        });
    });
});

app.get('/logout', function (request, response) {
  request.session.destroy(function(err) {
    if(err) console.error('err', err);
    response.send('<script>alert("로그아웃 되었습니다.");location.href="/index";</script>');
  });
});

app.post('/join', function (request, response) {
    var body = request.body;
    oracledb.getConnection( login ,
      function(err, connection) {
        if (err) { console.error(err.message); return; }
        connection.execute( "INSERT INTO MEMBER (M_NUM, PWD, M_NAME, DEPT, JOB) VALUES (:m_num, :pwd, :m_name, :dept, :job)",
          [body.r_st_num, body.r_password, body.r_name, body.r_dept, body.r_job ],
          function (err) {
            if(err) { 
              console.log(err.message); 
              response.send('<script>alert("중복된 아이디 입니다");history.back();</script>');
              return; }
              connection.commit(function(err){
              if(err) { 
                console.log(err.message);
                return; }
              response.send('<script>alert("가입되었습니다");location.href="/index";</script>')
            })
          });
      });
});

/****************************** 관리자 페이지 시작 ***********************************/
app.get('/admin/login/', function(request, response) {
  if(request.session.admin_id){
    response.send('<script>location.href="/admin/member/";</script>');
  } else {
  fs.readFile('./public/admin/login.html', 'utf8', function (error, data) {
    response.send(data);
  });
  }
});

app.post('/admin/login/', function(request, response) {
  var body = request.body;
  oracledb.createPool (
    {
    user          : dbConfig.user,
    password      : dbConfig.password,
    connectString : dbConfig.connectString,
    poolMax       : 4, // maximum size of the pool
    poolMin       : 0, // let the pool shrink completely
    poolIncrement : 1, // only grow the pool by one connection at a time
    poolTimeout   : 0  // never terminate idle connections
    },
    function(err, pool)
    {
      if(err) { console.error("createPool() callback:" + err.message); return; }

      pool.getConnection(
        function(err, connection)
        {
          if(err) {handleError(response, "getConnection() failed ", err); return; }

          connection.execute(
            "SELECT COUNT(*) CNT FROM MEMBER WHERE M_NUM = :ID AND PWD = :PWD AND JOB = 0",
            [body.id, body.password],
            function(err,result)
            {
              if(err) { connection.release (
                function(err) {
                  if (err) {
                    handleError(response, "execute() error release() callback", err);
                    return;
                  }
                });
              handleError(response, "execute() callback", err);
              return;
              }
              //displayResults(response, result, deptid);
              console.log(result.rows[0]);
              var cnt = result.rows[0].CNT;
              if(cnt == 1) {
                request.session.admin_id = body.id;
                response.send('<script>alert("정상 로그인되었습니다!.");location.href="/admin/member/";</script>');
              } else {
                response.send('<script>alert("아이디나 비밀번호가 틀립니다.");history.back();</script>');
              }
              connection.release(
                function(err)
                {
                  if(err) { 
                    handleError(response, "normal release() callback", err); 
                    return; 
                  }
                });
            });
        });
    });
});

app.get('/admin/logout/',function (request, response) {
  request.session.destroy(function(err) {
    if(err) console.error('err', err);
    response.send('<script>alert("로그아웃 되었습니다");location.href="/admin/login/";</script>');
  });
});

app.get('/admin/book/', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/booklist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num",
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/book/search', function (request, response) {
  var body = request.body;
  var id = Number(body.s_option);
  var s_content = '%' + body.s_content + '%';
  function query(id) {
    var query1;
    if(id == 1) {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and (b.b_num LIKE :ID OR c.c_name LIKE :ID OR b.b_name LIKE :ID OR author LIKE :ID OR publisher LIKE :ID)";
    } else if(id == 2) {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and b.b_num LIKE :ID";
    } else if(id == 3) { 
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and c.c_name LIKE :ID";
    } else if(id == 4) {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and b.b_name LIKE :ID";
    } else if(id == 5){
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and author LIKE :ID";
    } else {
      query1 = "select b.b_num, c.c_name as b_kind, b.b_name, author, publisher, decode(b.isborrow, 0, '대출가능', '대출불가능') as isborrow from book b, category c where b.b_kind = c.c_num and publisher LIKE :ID)";
    }
    return query1;
  }
  if(request.session.admin_id) {
  fs.readFile('./public/admin/booklist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          query(id),
          [s_content],
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/book/delete/:id', function (request, response) {
  if(request.session.admin_id) {
  oracledb.getConnection( login,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "DELETE FROM BOOK WHERE B_NUM = :ID",
        [request.param('id')], 
        function(err) {
          if(err) { console.log(err.messag); return; }
          connection.commit(function(err) {
            if(err) { console.log(err.messag); return; }
            response.redirect('/admin/book/');
          })
        });
    });
  } else {
    response.send('<script>alert("비정상적인 접근"); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/book/insert', function (request, response) { 
  if(request.session.admin_id){
  fs.readFile('./public/admin/bookinsert.html', 'utf8', function (error, data) {
    response.send(data);
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/book/insert', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  oracledb.getConnection( login ,
    function(err, connection) {
      if (err) { console.error(err.message); return; }
      connection.execute( "INSERT INTO BOOK VALUES (:b_kind, :b_num, :b_name, :author, :publisher, :isborrow)",
        [body.b_kind, body.b_num, body.b_name, body.author, body.publisher, body.isborrow],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/book/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/book/edit/:id', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/bookedit.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( "SELECT * FROM BOOK WHERE B_NUM = :id",
          [request.param('id')],
          function (err, result)
          {
            var results = result.rows
          response.send(ejs.render(data,
              { 
                data: results[0]
              }));
        console.log(results[0]);
        doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("비정상적인 접근"); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/book/edit/:id', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  console.log(body);

  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "UPDATE BOOK SET B_KIND = :b_kind, B_NAME = :b_name, AUTHOR = :author, PUBLISHER = :publisher, ISBORROW = :isborrow WHERE B_NUM = :b_num",
        [ body.b_kind, body.b_name, body.author, body.publisher, body.isborrow, body.b_num],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/book/');
          })
        });
    }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }

});
/****************************Member*******************************/
app.get('/admin/member/', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/memberlist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          "select m.m_num, m.pwd, m.m_name, m.dept, j.j_name as job, decode(m.isdelay, 0, '대출가능', '연체중') as isdelay from member m, job j where m.job = j.j_num",
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/member/search', function (request, response) {
  var body = request.body;
  var id = Number(body.s_option);
  var s_content = '%' + body.s_content + '%';
  function query(id) {
    var query1;
    if(id == 1) {
      query1 = "select m.m_num, m.pwd, m.m_name, m.dept, j.j_name as job, decode(m.isdelay, 0, '대출가능', '연체중') as isdelay from member m, job j where m.job = j.j_num and (m.m_num LIKE :ID OR m.m_name LIKE :ID OR j.j_name LIKE :ID OR m.dept LIKE :ID)";
    } else if(id == 2) {
      query1 = "select m.m_num, m.pwd, m.m_name, m.dept, j.j_name as job, decode(m.isdelay, 0, '대출가능', '연체중') as isdelay from member m, job j where m.job = j.j_num and m.m_num LIKE :ID";
    } else if(id == 3) { 
      query1 = "select m.m_num, m.pwd, m.m_name, m.dept, j.j_name as job, decode(m.isdelay, 0, '대출가능', '연체중') as isdelay from member m, job j where m.job = j.j_num and m.m_name LIKE :ID";
    } else if(id == 4) {
      query1 = "select m.m_num, m.pwd, m.m_name, m.dept, j.j_name as job, decode(m.isdelay, 0, '대출가능', '연체중') as isdelay from member m, job j where m.job = j.j_num and m.dept LIKE :ID";
    } else {
      query1 = "select m.m_num, m.pwd, m.m_name, m.dept, j.j_name as job, decode(m.isdelay, 0, '대출가능', '연체중') as isdelay from member m, job j where m.job = j.j_num and j.j_name LIKE :ID";
    }
    return query1;
  }
  if(request.session.admin_id) {
  fs.readFile('./public/admin/memberlist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          query(id),
          [s_content],
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});


app.get('/admin/member/delete/:id', function (request, response) {
  if(request.session.admin_id) {
    var count;
/*          "select count(*) CNT from member m, borrow b where m.m_num = b.m_num and m.m_num = :m_num and isreturn = 0",
            [request.param('id')],
  console.log("2: " + request.session.user_id);
            console.log("2 :" + request.session.count);*/
    oracledb.getConnection( login,
      function(err, connection)
      {
        console.log(request.param('id'));
        if (err) { console.error(err.message); return; }
        connection.execute( "DELETE FROM MEMBER WHERE M_NUM = :ID",
          [request.param('id')], 
          function(err) {
            if(err) { console.log(err.message); return; }
            connection.commit(function(err) {
              if(err) { console.log(err.message); return; }
              response.redirect('/admin/member/');
            })
          });
      });
    /*} else {
    response.send('<script>alert("대출중인 책이 있습니다."); location.href="/admin/member/"</script>');
    }*/
} else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/member/insert', function (request, response) { 
  if(request.session.admin_id) {
  fs.readFile('./public/admin/memberinsert.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( "SELECT * FROM JOB WHERE J_NUM > 0",
          function (err, result)
          {
            var results = result.rows;
            console.log(results);
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            console.log(results);
            doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/member/insert', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  oracledb.getConnection( login ,
    function(err, connection) {
      if (err) { console.error(err.message); return; }
      connection.execute( "INSERT INTO MEMBER VALUES (:m_num, :pwd, :m_name, :dept, :job, :isdelay)",
        [body.m_num, body.pwd, body.m_name, body.dept, body.job, body.isdelay],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/member/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/member/edit/:id', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/memberedit.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( "SELECT * FROM MEMBER WHERE M_NUM = :id",
          [request.param('id')],
          function (err, result)
          {
            var results = result.rows
          response.send(ejs.render(data,
              { 
                data: results[0]
              }));
        console.log(results[0]);
        doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/member/edit/:id', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  console.log(body);

  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "UPDATE MEMBER SET PWD = :pwd, M_NAME = :m_name, DEPT = :dept, JOB = :job, ISDELAY = :isdelay WHERE M_NUM = :m_num",
        [body.pwd, body.m_name, body.dept, body.job, body.isdelay, body.m_num],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/member/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});


/********************** Category ********************/
app.get('/admin/category/', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/categorylist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          "SELECT * FROM CATEGORY",
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/category/delete/:id', function (request, response) {
  if(request.session.admin_id) {
  oracledb.getConnection( login,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "DELETE FROM CATEGORY WHERE C_NUM = :ID",
        [request.param('id')], 
        function(err) {
          if(err) { console.log(err.messag); return; }
          connection.commit(function(err) {
            if(err) { console.log(err.messag); return; }
            response.redirect('/admin/category/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});
app.get('/admin/category/insert', function (request, response) { 
  if(request.session.admin_id) {
  fs.readFile('./public/admin/categoryinsert.html', 'utf8', function (error, data) {
    response.send(data);
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/category/insert', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  oracledb.getConnection( login ,
    function(err, connection) {
      if (err) { console.error(err.message); return; }
      connection.execute( "INSERT INTO CATEGORY VALUES (:c_num, :b_name)",
        [body.c_num, body.c_name],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/category/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/category/edit/:id', function (request, response) {
  if(request.session.admin_id){
  fs.readFile('./public/admin/categoryedit.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( "SELECT * FROM CATEGORY WHERE C_NUM = :id",
          [request.param('id')],
          function (err, result)
          {
            var results = result.rows
          response.send(ejs.render(data,
              { 
                data: results[0]
              }));
        console.log(results[0]);
        doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/category/edit/:id', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  console.log(body);

  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "UPDATE CATEGORY SET C_NAME = :c_name WHERE C_NUM = :c_num",
        [body.c_name, body.c_num],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/category/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

/********************** BorrowConfirm ********************/
app.get('/admin/confirm/', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/confirmlist.html', 'utf8', function (error, data) {
    oracledb.getConnection(login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)",
          function (err, result)
          {
            console.log(result);
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/confirm/search', function (request, response) {
  var body = request.body;
  var id = Number(body.s_option);
  var s_content = '%' + body.s_content + '%';
  function query(id) {
    var query1;
    if(id == 1) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (A.M_NUM LIKE :ID OR A.M_NAME LIKE :ID OR A.DEPT LIKE :ID OR B.B_NUM LIKE :ID OR B.B_NAME LIKE :ID OR B.AUTHOR LIKE :ID OR B.PUBLISHER LIKE :ID)";
    } else if(id == 2) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (A.M_NUM LIKE :ID)";
    } else if(id == 3) { 
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (A.M_NAME LIKE :ID)";
    } else if(id == 4) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (A.DEPT LIKE :ID)";
    } else if(id == 5){
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (B.B_NUM LIKE :ID)";
    } else if(id == 6){
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (B.B_NAME LIKE :ID)";
    } else if(id ==7) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (B.AUTHOR LIKE :ID)";
    } else {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, E.J_NAME AS JOB, D.C_NAME AS B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER FROM MEMBER A, BOOK B, BORROWCHECK C, CATEGORY D, JOB E WHERE (A.M_NUM = C.M_NUM) AND ((B.B_NUM = C.B_NUM) AND (B.B_KIND = D.C_NUM) AND (A.JOB = E.J_NUM)) AND (B.PUBLISHER LIKE :ID)";
    }
    return query1;
  }
  if(request.session.admin_id) {
  fs.readFile('./public/admin/confirmlist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          query(id),
          [s_content],
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/confirm/delete/:id', function (request, response) {
  if(request.session.admin_id) {
  oracledb.getConnection( login,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "DELETE FROM BORROWCHECK WHERE B_NUM = :ID",
        [request.param('id')],
        function(err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err) {
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/confirm/');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/confirm/confirm', function (request, response) {
  var body = request.body;
  var job = Number(body.job);
  function confirmQuery(id) {
    var query1;
    if(id == 1) {  //교수
        query1 = "insert into borrow(idx, b_num, m_num, b_date, r_date) values(seq_borrow.nextval, :B_NUM, :M_NUM, to_date(sysdate, 'dd-mm-yyyy'), to_date(sysdate + 180, 'dd-mm-yyyy'))";
    } else if(id == 2) { //교직원
        query1 = "insert into borrow(idx, b_num, m_num, b_date, r_date) values(seq_borrow.nextval, :B_NUM, :M_NUM, to_date(sysdate, 'dd-mm-yyyy'), to_date(sysdate + 90, 'dd-mm-yyyy'))";
    } else if(id == 3) {  //대학원생
        query1 = "insert into borrow(idx, b_num, m_num, b_date, r_date) values(seq_borrow.nextval, :B_NUM, :M_NUM, to_date(sysdate, 'dd-mm-yyyy'), to_date(sysdate + 30, 'dd-mm-yyyy'))";
    } else { //학부생
        query1 = "insert into borrow(idx, b_num, m_num, b_date, r_date) values(seq_borrow.nextval, :B_NUM, :M_NUM, to_date(sysdate, 'dd-mm-yyyy'), to_date(sysdate + 15, 'dd-mm-yyyy'))";
    }
    return query1;
  }
  if(request.session.admin_id) {
    console.log(body);

    oracledb.getConnection( login ,
      function(err, connection)
      {
      if (err) { console.error(err.message); return; }
      connection.execute( "DELETE FROM BORROWCHECK WHERE B_NUM = :ID",
        [body.b_num],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
          })
        });
    });
    
  oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute( 
          confirmQuery(job),
          [body.b_num, body.m_num],
          function (err) {
            if(err) { console.log(err.message); return; }
            connection.commit(function(err){
              if(err) { console.log(err.message); return; }
              response.redirect('/admin/confirm/');
            })
          });
      });

  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});
/********************** Borrow ********************/
app.get('/admin/borrow/', function (request, response) {
  if(request.session.admin_id) {
  fs.readFile('./public/admin/borrowlist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE (A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)",
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});
app.post('/admin/borrow/search', function (request, response) {
  var body = request.body;
  var id = Number(body.s_option);
  var s_content = '%' + body.s_content + '%';
  function query(id) {
    var query1;
    if(id == 1) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (A.M_NUM LIKE :ID OR A.M_NAME LIKE :ID OR A.DEPT LIKE :ID OR B.B_NUM LIKE :ID OR B.B_NAME LIKE :ID OR B.AUTHOR LIKE :ID OR B.PUBLISHER LIKE :ID)";
    } else if(id == 2) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (A.M_NUM LIKE :ID)";
    } else if(id == 3) { 
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (A.M_NAME LIKE :ID)";
    } else if(id == 4) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (A.DEPT LIKE :ID)";
    } else if(id == 5){
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (B.B_NUM LIKE :ID)";
    } else if(id == 6){
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (B.B_NAME LIKE :ID)";
    } else if(id ==7) {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (B.AUTHOR LIKE :ID)";
    } else {
      query1 = "SELECT A.M_NUM, A.M_NAME, A.DEPT, D.J_NAME JOB, E.C_NAME B_KIND, B.B_NUM, B.B_NAME, B.AUTHOR, B.PUBLISHER, TO_CHAR(C.B_DATE, 'YY-MM-DD') B_DATE, TO_CHAR(C.R_DATE, 'YY-MM-DD') R_DATE, DECODE(C.ISRETURN, 0, '대출중', '반납완료') as ISRETURN, C.IDX FROM MEMBER A, BOOK B, BORROW C, JOB D, CATEGORY E WHERE ((A.M_NUM = C.M_NUM) AND (B.B_NUM = C.B_NUM) AND (A.JOB = D.J_NUM) AND (E.C_NUM = B.B_KIND)) AND (B.PUBLISHER LIKE :ID)";
    }
    return query1;
  }
  if(request.session.admin_id) {
  fs.readFile('./public/admin/borrowlist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          query(id),
          [s_content],
          function (err, result)
          {
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
            doRelease(connection);
          });
      });
  }); 
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});
app.get('/admin/borrow/delete/:id', function (request, response) {
  if(request.session.admin_id) {
  oracledb.getConnection( login,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "DELETE FROM BORROW WHERE IDX = :ID",
        [request.param('id')], 
        function(err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err) {
            if(err) { console.log(err.message); return; }
            response.send('<script>alert("삭제되었습니다."); location.href="/admin/borrow/"</script>');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.get('/admin/borrow/insert', function (request, response) { 
  if(request.session.admin_id) {
  fs.readFile('./public/admin/borrowinsert.html', 'utf8', function (error, data) {
    response.send(data);
  });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});

app.post('/admin/borrow/return', function (request, response) {
  if(request.session.admin_id) {
  var body = request.body;
  console.log(body);
  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "UPDATE BORROW SET ISRETURN = 1 WHERE IDX = :idx",
        [body.idx],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.send('<script>alert("반납되었습니다"); location.href="/admin/borrow/"</script>');
          })
        });
    });
  } else {
    response.send('<script>alert("로그인이 필요합니다."); location.href="/admin/login/"</script>');
  }
});



/****************************** 관리자 페이지 끝 ***********************************/
http.createServer(app).listen(52273, function () {
  console.log('Server Running at http://127.0.0.1:52273');
});
