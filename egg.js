var specialForms = Object.create(null);
var topEnv = Object.create(null);
topEnv.true = true;
topEnv.false = false;
topEnv.array = function () {
  return Array.prototype.slice.call(arguments, null);
};
topEnv.length = function (array) {
  return array.length;
};
topEnv.element = function (array, n) {
  return array[n];
};
topEnv.print = function (value) {
  console.log(value);
  return value;
};

function skipSpace(string) {
  var first = string.search(/\S/);
  if (first === -1) {
    return '';
  }
  return string.slice(first);
}

function parseApply(expr, program) {
  var arg;
  program = skipSpace(program);
  if (program[0] !== '(') {
    return {
      expr: expr,
      rest: program
    };
  }
  program = skipSpace(program.slice(1));
  expr = {
    type: 'apply',
    operator: expr,
    args: []
  };
  while (program[0] !== ')') {
    arg = parseExpression(program);
    expr.args.push(arg.expr);
    program = skipSpace(arg.rest);
    if (program[0] === ',') {
      program = skipSpace(program.slice(1));
    } else if (program[0] !== ')') {
      throw new SyntaxError('Expected "," or ")"');
    }
  }
  return parseApply(expr, program.slice(1));
}

function parseExpression(program) {
  var match;
  var expr;
  program = skipSpace(program);
  if (match = /^"([^"]*)"/.exec(program)) {
    expr = {
      type: 'value',
      value: match[1]
    };
  } else if (match = /^\d+\b/.exec(program)) {
    expr = {
      type: 'value',
      value: Number(match[0])
    };
  } else if (match = /^[^\s(),"]+/.exec(program)) {
    expr = {
      type: 'word',
      name: match[0]
    };
  } else {
    throw new SyntaxError('Unexpected syntax: ' + program);
  }
  return parseApply(expr, program.slice(match[0].length));
}

function parse(program) {
  var result = parseExpression(program);
  if (skipSpace(result.rest).length > 0) {
    throw new SyntaxError('Unexpected text after program');
  }
  return result.expr;
}

function evaluate(expr, env) {
  var op;
  switch (expr.type) {
    case 'value':
      return expr.value;
    case 'word':
      if (expr.name in env) {
        return env[expr.name];
      }
      throw new ReferenceError('Undefined variable: ' + expr.name);

    case 'apply':
      if (expr.operator.type === 'word' && expr.operator.name in specialForms) {
        return specialForms[expr.operator.name](expr.args, env);
      }
      op = evaluate(expr.operator, env);
      if (typeof op !== 'function') {
        throw new TypeError('Applying a non-function.');
      }
      return op.apply(null, expr.args.map(function (arg) {
        return evaluate(arg, env);
      }));
  }
}

specialForms.if = function (args, env) {
  if (args.length !== 3) {
    throw new SyntaxError('Bad number of args to if');
  }
  if (evaluate(args[0], env) !== false) {
    return evaluate(args[1], env);
  }
  return evaluate(args[2], env);
};

specialForms.while = function (args, env) {
  if (args.length !== 2) {
    throw new SyntaxError('Bad number of args to while');
  }
  while (evaluate(args[0], env) !== false) {
    evaluate(args[1], env);
  }
  return false;
};

specialForms.do = function (args, env) {
  var value = false;
  args.forEach(function (arg) {
    value = evaluate(arg, env);
  });
  return value;
};

specialForms.define = function (args, env) {
  var value;
  if (args.length !== 2 || args[0].type !== 'word') {
    throw new SyntaxError('Bad use of define');
  }
  value = evaluate(args[1], env);
  env[args[0].name] = value;
  return value;
};

specialForms.fun = function (args, env) {
  var argNames;
  var body;
  if (!args.length) {
    throw new SyntaxError('Functions need a body');
  }

  function name(expr) {
    if (expr.type !== 'word') {
      throw new SyntaxError('Arg names must be words');
    }
    return expr.name;
  }
  argNames = args.slice(0, args.length - 1).map(name);
  body = args[args.length - 1];

  return function () {
    var localEnv;
    var i;
    if (arguments.length !== argNames.length) {
      throw new TypeError('Wrong number of arguments');
    }
    localEnv = Object.create(env);
    for (i = 0; i < arguments.length; i += 1) {
      localEnv[argNames[i]] = arguments[i];
    }
    return evaluate(body, localEnv);
  };
};

function run() {
  var env = Object.create(topEnv);
  var program = Array.prototype.slice.call(arguments, 0).join('\n');
  return evaluate(parse(program), env);
}

['+', '-', '*', '/', '==', '<', '>'].forEach(function (op) {
  topEnv[op] = new Function('a, b', 'return a ' + op + ' b;');
});

run("do(define(sum, fun(array,",
  "     do(define(i, 0),",
  "        define(sum, 0),",
  "        while(<(i, length(array)),",
  "          do(define(sum, +(sum, element(array, i))),",
  "             define(i, +(i, 1)))),",
  "        sum))),",
  "   print(sum(array(1, 2, 3, 4))))");
// 10
