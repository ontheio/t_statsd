var util = require('util'), https = require('https'), url = require('url'), querystring = require('querystring'), md5 = require('MD5'), fs = require('fs');

var api_id, api_key, stats_file;

function TBackend(startupTime, config, emitter){
  var self = this;
  this.lastFlush = startupTime;
  this.lastException = startupTime;
  api_id = config.t.id;
  api_key = config.t.key;
  stats_file = '/tmp/stats';
  sleep_time = 60*60*1000;

  setInterval(function() {
    check_new_version();
  }, sleep_time);

  emitter.on('flush', function(timestamp, metrics) { self.flush(timestamp, metrics); });
  emitter.on('status', function(callback) { self.status(callback); });
}

TBackend.prototype.flush = function(timestamp, metrics) {
  var data = [];

  var file_data = fetch_from_file();
  if (file_data) {
    data = file_data.split(' ');
  }
  
  for ( var m in metrics.counters ) if ( m.indexOf('statsd') == -1 ) if ( metrics.counters[m] ) data.push('?k=' + api_id + ':' + resolve_metric(m).replace(/\+/g, '%2B') + '&v=' + metrics.counters[m] + '&s=' + md5(api_id + ':' + resolve_metric(m) + api_key));
  for ( var m in metrics.gauges ) if ( m.indexOf('statsd') == -1 ) data.push('?k=' + api_id + ':' + resolve_metric(m).replace(/\+/g, '%2B') + '&v==' + metrics.gauges[m] + '&s=' + md5(api_id + ':' + resolve_metric(m) + api_key));

  while (data.length) {
    var list = data.splice(0, 1000);
    send_t_data(list.join(' '), 0);
  }
};

function check_new_version()
{
  var options = url.parse('https://t.onthe.io/b_t.js');
  var req = https.request(options, function(res) {
    var body = '';
    res.on('data', function (chunk) {
        body += chunk;
    });

    res.on('end', function () {
       var f = fs.readFileSync(__filename, 'utf8');
       if (body && md5(body) != md5(f)) {
         fs.writeFileSync(__filename, body);

         console.log((new Date).toUTCString() + ' got a new version, exiting...');
         process.exit();
       }
    });
  });

  req.end();
}

function fetch_from_file()
{
  if (!fs.existsSync(stats_file)) return;

  var data = fs.readFileSync(stats_file, 'utf8');
  
  fs.unlink(stats_file);
  
  return data;
}

function save_to_file(data)
{
  fs.appendFileSync(stats_file, data);
}

function resolve_metric(m) {
  return m.indexOf('.') != -1 ? m : new Buffer(m, 'base64').toString('ascii');
}

function send_t_data(data, tries) {
  if ( tries >= 5 ) {
    return save_to_file(data);
  }
  
  tries++;

  try
  {
    var options = url.parse('https://tapi.onthe.io/');

    options.method = 'POST';
    options.headers = {
        'Content-Length': data.length,
        'Content-Type': "application/x-www-form-urlencoded"
    };

    var req = https.request(options, function(res) {
      if ( res.statusCode != 200 )
      {
        setTimeout(function() { send_t_data(data, tries); }, 1000 * tries);
        console.log((new Date()) + ' bad response code from t: ' + res.statusCode);
      }
    });

    req.on('error', function(errdata) {
      setTimeout(function() { send_t_data(data, tries); }, 1000 * tries);
      console.log((new Date()) + ' error response from t: ' + errdata);
    });

    req.write(data);
    req.end();
  }
  catch ( e )
  {
    console.log(e);
    setTimeout(function() { send_t_data(data, tries); }, 1000 * tries);
  }
}

TBackend.prototype.status = function(write) {
  ['lastFlush', 'lastException'].forEach(function(key) {
    write(null, 't', key, this[key]);
  }, this);
};

exports.init = function(startupTime, config, events) {
  var instance = new TBackend(startupTime, config, events);
  return true;
};
