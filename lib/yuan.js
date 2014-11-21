'use strict';

var rWhitespace = /[\r\t\n]/g;

var STATUS = {
  DEFAULT: 0,
  CURLY_START: 1,
  BLOCK_START: 2,
  BLOCK_END: 3,
  VAR_START: 4,
  VAR_END: 5,
  COMMENT_START: 6,
  COMMENT_END: 7
};

var TYPES = {
  LITERAL: 0,
  VARIABLE: 1,
  BLOCK: 2,
  COMMENT: 3
};

function Yuan(options){
  this.tags = {};
  this.filters = {};
  this.options = options || {};
}

Yuan.prototype.compile = function(str){
  var tokens = this._tokenize(str);
  var tags = this.tags;
  var filters = this.filters;
  var result = [];
  var token;

  for (var i = 0, len = tokens.length; i < len; i++){
    token = tokens[i];

    switch (token.type){
      case TYPES.LITERAL:
        result.push('"' + token.value.replace(rWhitespace, '') + '"');
        break;

      case TYPES.VARIABLE:
        this._parseVariable(result, token);
        break;

      case TYPES.BLOCK:
        this._parseBlock(result, token);
        break;
    }
  }

  var content = 'return ' + result.join('+');
  var fn = Function('tags', 'filters', 'obj', content);

  return function(obj){
    obj = obj || {};
    return fn(tags, filters, obj);
  };
};

Yuan.prototype.render = function(str, options){
  var fn = this.compile(str);
  return fn(options);
};

Yuan.prototype._tokenize = function(content){
  var status = STATUS.DEFAULT;
  var result = [];
  var str = '';
  var value = '';

  function summarize(type){
    result.push({
      type: type,
      value: value
    });

    value = '';
  }

  for (var i = 0, len = content.length; i < len; i++){
    str = content[i];

    if (str === '{'){
      if (status === STATUS.CURLY_START){
        status = STATUS.VAR_START;
        summarize(TYPES.LITERAL);
      } else {
        status = STATUS.CURLY_START;
      }
    } else if (str === '}'){
      if (status === STATUS.VAR_START){
        status = STATUS.VAR_END;
      } else if (status === STATUS.VAR_END){
        status = STATUS.DEFAULT;
        summarize(TYPES.VARIABLE);
      } else if (status === STATUS.BLOCK_END){
        status = STATUS.DEFAULT;
        summarize(TYPES.BLOCK);
      } else if (status === STATUS.COMMENT_END){
        status = STATUS.DEFAULT;
        summarize(TYPES.COMMENT);
      } else {
        value += str;
      }
    } else if (str === '%'){
      if (status === STATUS.CURLY_START){
        status = STATUS.BLOCK_START;
        summarize(TYPES.LITERAL);
      } else if (status === STATUS.BLOCK_START){
        status = STATUS.BLOCK_END;
      } else {
        value += str;
      }
    } else if (str === '#'){
      if (status === STATUS.CURLY_START){
        status = STATUS.COMMENT_START;
        summarize(TYPES.LITERAL);
      } else if (status === STATUS.COMMENT_START){
        status = STATUS.COMMENT_END;
      } else {
        value += str;
      }
    } else {
      if (status === STATUS.CURLY_START){
        value += '{' + str;
        status = STATUS.DEFAULT;
      } else if (status === STATUS.VAR_END){
        value += '}' + str;
        status = STATUS.VAR_START;
      } else if (status === STATUS.BLOCK_END){
        value += '%' + str;
        status = STATUS.BLOCK_START;
      } else if (status === STATUS.COMMENT_END){
        value += '#' + str;
        status = STATUS.COMMENT_START;
      } else {
        value += str;
      }
    }
  }

  if (value){
    summarize(TYPES.LITERAL);
  }

  return result;
};

Yuan.prototype._parseVariable = function(result, token){
  var str = token.value.trim();
  result.push('(obj.hasOwnProperty("' + str + '") ? obj.' + str + ' : "")');
};

Yuan.prototype._parseBlock = function(result, token){
  var str = token.value.trim();
  var split = str.split(' ');
  var name = split.shift();
  var block = '';
  var lastResult = '';

  if (!name) throw new SyntaxError('Tag name is required!');

  if (name.substring(0, 3) === 'end'){
    name = name.substring(3);
    block = result.splice(result.length - 1, 1);
    lastResult = result[result.length - 1];

    result[result.length - 1] = lastResult.substring(0, lastResult.length - 2) + ',' + block + '))';
  } else {
    for (var i = 0, len = split.length; i < len; i++){
      split[i] = '"' + split[i] + '"';
    }

    result.push('(typeof tags.' + name + ' !== "function" ? "" : ' +
      'tags.' + name + '.call(obj,[' + split.join(',') + ']))');
  }
};

exports = module.exports = new Yuan();
exports.Yuan = Yuan;