Bugsense.Errors = (function () {

  var getOffendingLine = function(stacktrace, line) {
    return (line < TraceKit.linesOfContext/2
      ? stacktrace[line-1]
      : stacktrace[5]);
  };
  var computeErrorHash = function (offendingLine, message, line, klass, appVersion) {
    var string = offendingLine+message+line+klass+appVersion;
    return md5(string);
  };
  var testException = function(exception) {
    return Object.prototype.toString.call(exception) === '[object Error]';
  };

  var parse = function(data) {
    var stack = data.errorobj ? data.errorobj.stack : data.stack || null;
    var parsedError = { // Chrome
      message: data.exception || data.message,
      url: data.url || data.lineNumber || data.sourceURL,
      line: data.line,
      stack: stack,
    };
    parsedError.custom_data = data.custom_data || {};

    return parsedError;
  };

  var generateExceptionData = function(error) {
    var message = ( typeof(error) != "string" ) ? error.message : error,
        crash = {},
        stacktrace = getStackTrace(error),
        url = error.url || error.lineNumber || error.sourceUrl,
        line = error.line,
        klass = url && line ? TraceKit.computeStackTrace.guessFunctionName(url, line) : "unknown";
    // errorHash = this.computeErrorHash(this.getOffendingLine(stacktrace, line), msg[1], line, klass, this.dataFixture.appVersion)
    crash = extend(Bugsense.generateFixture(), {
      'exception': {
        'message': message,
        'where': [ url, line ].join( ':' ),
        'klass': klass,
        'backtrace': (stacktrace && stacktrace.length) ? stacktrace : [],
        'breadcrumbs': Bugsense.breadcrumbs
      },
    });
    crash.application_environment.log_data = extend(Bugsense.extraData, error.custom_data)

    return crash;
  };

  var generateStackTrace = function(error) {
    var stack = TraceKit.computeStackTrace(error).stack;
    if (stack) {
      return stack.map(function(s) {
        return s.func+"@"+s.url+":"+s.line;
      });
    } else {
      return [];
    }
  };
  var getStackTrace = function(error) {
    return error.stack || generateStackTrace(error);
  };


  Bugsense.notify = function(data, custom_data) {
    var parsedError = {};
    if(custom_data) data.custom_data = custom_data;
    parsedError = parse(data);

    Bugsense.Network.send(generateExceptionData(parsedError), 'POST');
    return false;
  };

  window.onerror = function(exception, url, line, column, errorobj) {
    if(!Bugsense.config.disableOnError) {
      if(Bugsense.config.apiKey) {
        Bugsense.trigger('crash');

        return Bugsense.notify({
          exception: exception,
          url: url,
          line: line,
          column: column,
          errorobj: errorobj
        });
      } else {
        var msg = 'You need a BugSense API key to use bugsense.js.';
        if('warn' in console) console.warn(msg)
        else console.log(msg);
        return false
      }
    }
    return false;
  };

  return {
    parse: parse,
    computeErrorHash: computeErrorHash,
    generateExceptionData: generateExceptionData
  }
}());
