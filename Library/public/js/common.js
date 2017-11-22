var getParam = function(key){
  var _parammap = {};
  document.location.search.replace(/\??(?:([^=]+)=([^&]*)&?)/g, function () {
    function decode(s) {
      return decodeURIComponent(s.split("+").join(" "));
    }

    _parammap[decode(arguments[1])] = decode(arguments[2]);
  });

  return _parammap[key];
};

function showDiv(id) {
  var showdiv = document.getElementById(id);
  showdiv.style.display = "block";
};

function hideDiv(id) {
  var hidediv = document.getElementById(id);
  hidediv.style.display = "none";
};

function showAndhide(show, hide) {
  var showdiv = document.getElementById(id);
  var hidediv = document.getElementById(id);

  showdiv.style.display = "block";
  hidediv.style.display = "none";
};

function formSubmit(id)
{
  document.getElementById(id).submit()
};

function sendIndex(value, id2)
{
  //var index = document.getElementById(id1).innerHTML;
  document.getElementById(id2).value = value;
}
  
