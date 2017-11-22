var fs = require('fs');
var ejs = require('ejs');
var http = require('http');
var express = require('express');
var oracledb = require('oracledb');
var dbConfig = require('../../dbconfig.js');
oracledb.outFormat = oracledb.OBJECT;

var login = { user : dbConfig.user, password : dbConfig.password, connectString : dbConfig.connectString };

function doRelease(connection)
{
  connection.release(
      function(err) {
        if (err) {
          console.err(err.message);
        }
      });
}

var app = express();
app.use(express.bodyParser());
app.use(app.router);

http.createServer(app).listen(52273, function () {
  console.log('server Running at http://127.0.0.1:52273');
});

app.get('/admin/book/', function (request, response) {
  fs.readFile('booklist.html', 'utf8', function (error, data) {
    oracledb.getConnection( login ,
      function(err, connection)
      {
        if (err) { console.error(err.message); return; }
        connection.execute(
          "SELECT * FROM BOOK",
          function (err, result)
          {
            console.log("2");
            var results = result.rows;
            response.send(ejs.render(data,
                { 
                  data: results
                }));
        doRelease(connection);
          });
      });
  });
});

app.get('/admin/book/delete/:id', function (request, response) {
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
});
app.get('/admin/book/insert', function (request, response) { 
  fs.readFile('bookinsert.html', 'utf8', function (error, data) {
    response.send(data);
  });
});

app.post('/admin/book/insert', function (request, response) {
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
});

app.get('/admin/book/edit/:id', function (request, response) {
  fs.readFile('bookedit.html', 'utf8', function (error, data) {
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
});

app.post('/admin/book/edit/:id', function (request, response) {
  var body = request.body;

  oracledb.getConnection( login ,
    function(err, connection)
    {
      if (err) { console.error(err.message); return; }
      connection.execute( "UPDATE BOOK SET B_KIND = :b_kind, B_NAME = :b_name, AUTHOR = :author, PUBLISHER = :publisher, ISBORROW = :isborrow",
        [body.b_kind, body.b_name, body.author, body.publisher, body.isborrow],
        function (err) {
          if(err) { console.log(err.message); return; }
          connection.commit(function(err){
            if(err) { console.log(err.message); return; }
            response.redirect('/admin/book/');
          })
        });
    });
});

