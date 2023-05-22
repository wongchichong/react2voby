var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e2) {
        reject(e2);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e2) {
        reject(e2);
      }
    };
    var step = (x2) => x2.done ? resolve(x2.value) : Promise.resolve(x2.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};
var _a, _b;
import ts, { createSourceFile, ScriptTarget, SyntaxKind, ScriptKind, transform as transform$1, visitNode, visitEachChild, createCompilerHost, createProgram, readConfigFile, sys, parseJsonConfigFileContent } from "typescript";
import { sync } from "glob";
import * as path from "path";
import { join, dirname } from "path";
import yargs from "yargs";
import * as fs from "fs";
import fs__default from "fs";
import { isPromise } from "util/types";
import JSON from "json5";
import chalk, { red, green, yellow } from "chalk";
function createAST(source, fileName, scriptKind) {
  return createSourceFile(fileName || "", source, ScriptTarget.Latest, true, scriptKind);
}
const syntaxKindMap = {};
for (const name of Object.keys(SyntaxKind).filter((x2) => isNaN(parseInt(x2, 10)))) {
  const value = SyntaxKind[name];
  if (!syntaxKindMap[value]) {
    syntaxKindMap[value] = name;
  }
}
function syntaxKindName(kind) {
  return syntaxKindMap[kind];
}
const FILTERED_KEYS = ["parent"];
const LITERAL_KINDS = [
  SyntaxKind.FalseKeyword,
  SyntaxKind.NoSubstitutionTemplateLiteral,
  SyntaxKind.NullKeyword,
  SyntaxKind.NumericLiteral,
  SyntaxKind.RegularExpressionLiteral,
  SyntaxKind.StringLiteral,
  SyntaxKind.TrueKeyword
];
const PARSERS = {
  [SyntaxKind.FalseKeyword]: () => false,
  [SyntaxKind.NoSubstitutionTemplateLiteral]: (properties) => properties.text,
  [SyntaxKind.NullKeyword]: () => null,
  [SyntaxKind.NumericLiteral]: (properties) => +properties.text,
  [SyntaxKind.RegularExpressionLiteral]: (properties) => new RegExp(properties.text),
  [SyntaxKind.StringLiteral]: (properties) => properties.text,
  [SyntaxKind.TrueKeyword]: () => true
};
function traverseChildren(node, iterator, options2) {
  const ancestors = [];
  traverse(node, {
    enter(childNode, parentNode) {
      if (parentNode != null) {
        ancestors.unshift(parentNode);
      }
      iterator(childNode, ancestors);
    },
    leave() {
      ancestors.shift();
    },
    visitAllChildren: !!options2.visitAllChildren
  });
}
function traverse(node, traverseOptions) {
  traverseOptions.enter(node, node.parent || null);
  if (traverseOptions.visitAllChildren) {
    node.getChildren().forEach((child2) => traverse(child2, traverseOptions));
  } else {
    node.forEachChild((child2) => traverse(child2, traverseOptions));
  }
  traverseOptions.leave(node, node.parent || null);
}
function getVisitorKeys(node) {
  return !!node ? Object.keys(node).filter((key) => !FILTERED_KEYS.includes(key)).filter((key) => {
    const value = node[key];
    return Array.isArray(value) || typeof value === "object";
  }) : [];
}
const propertiesMap = /* @__PURE__ */ new WeakMap();
function getProperties(node) {
  let properties = propertiesMap.get(node);
  if (!properties) {
    properties = {
      kindName: syntaxKindName(node.kind),
      text: hasKey(node, "text") ? node.text : getTextIfNotSynthesized(node)
    };
    if (node.kind === SyntaxKind.Identifier) {
      properties.name = hasKey(node, "name") ? node.name : properties.text;
    }
    if (LITERAL_KINDS.includes(node.kind)) {
      properties.value = PARSERS[node.kind](properties);
    }
    propertiesMap.set(node, properties);
  }
  return properties;
}
function hasKey(node, property) {
  return node[property] != null;
}
function getTextIfNotSynthesized(node) {
  return !(node.pos >= 0) ? "" : node.getText();
}
function getPath(obj, path2) {
  const keys = path2.split(".");
  for (const key of keys) {
    if (obj == null) {
      return obj;
    }
    const properties = obj.getSourceFile ? getProperties(obj) : {};
    obj = key in properties ? properties[key] : obj[key];
  }
  return obj;
}
function inPath(node, ancestor, path2) {
  if (path2.length === 0) {
    return node === ancestor;
  }
  if (ancestor == null) {
    return false;
  }
  const [first] = path2;
  const field2 = ancestor[first];
  const remainingPath = path2.slice(1);
  if (Array.isArray(field2)) {
    return field2.some((item) => inPath(node, item, remainingPath));
  } else {
    return inPath(node, field2, remainingPath);
  }
}
const OPERATOR = {
  "=": equal,
  "!=": notEqual,
  "<=": lessThanEqual,
  "<": lessThan,
  ">=": greaterThanEqual,
  ">": greaterThan
};
function attribute(node, selector) {
  const obj = getPath(node, selector.name);
  if (obj === void 0) {
    return false;
  }
  const { operator } = selector;
  if (operator == null) {
    return obj != null;
  }
  const { type, value } = selector.value;
  const matcher = OPERATOR[operator];
  if (matcher) {
    return matcher(obj, value, type);
  }
  return false;
}
function equal(obj, value, type) {
  switch (type) {
    case "regexp":
      return typeof obj === "string" && value.test(obj);
    case "literal":
      return `${value}` === `${obj}`;
    case "type":
      return value === typeof obj;
  }
}
function notEqual(obj, value, type) {
  switch (type) {
    case "regexp":
      return typeof obj === "string" && !value.test(obj);
    case "literal":
      return `${value}` !== `${obj}`;
    case "type":
      return value !== typeof obj;
  }
}
function lessThanEqual(obj, value) {
  return obj <= value;
}
function lessThan(obj, value) {
  return obj < value;
}
function greaterThanEqual(obj, value) {
  return obj >= value;
}
function greaterThan(obj, value) {
  return obj > value;
}
function child(node, selector, ancestry) {
  if (findMatches(node, selector.right, ancestry)) {
    return findMatches(ancestry[0], selector.left, ancestry.slice(1));
  }
  return false;
}
const CLASS_MATCHERS = {
  declaration,
  expression,
  "function": fn,
  pattern,
  statement
};
function classs(node, selector, ancestry, options2) {
  if (!getProperties(node).kindName) {
    return false;
  }
  const matcher = CLASS_MATCHERS[selector.name.toLowerCase()];
  if (matcher) {
    return matcher(node, selector, ancestry, options2);
  }
  throw new Error(`Unknown class name: ${selector.name}`);
}
function declaration(node) {
  return getProperties(node).kindName.endsWith("Declaration");
}
function expression(node) {
  const { kindName } = getProperties(node);
  return kindName.endsWith("Expression") || kindName.endsWith("Literal") || kindName === "Identifier" && !!node.parent && getProperties(node.parent).kindName !== "MetaProperty" || kindName === "MetaProperty";
}
function fn(node) {
  const { kindName } = getProperties(node);
  return kindName.startsWith("Function") || kindName === "ArrowFunction";
}
function pattern(node) {
  return getProperties(node).kindName.endsWith("Pattern") || expression(node);
}
function statement(node) {
  return getProperties(node).kindName.endsWith("Statement") || declaration(node);
}
function descendant(node, selector, ancestry) {
  if (findMatches(node, selector.right, ancestry)) {
    return ancestry.some((ancestor, index) => {
      return findMatches(ancestor, selector.left, ancestry.slice(index + 1));
    });
  }
  return false;
}
function field(node, selector, ancestry) {
  const path2 = selector.name.split(".");
  const ancestor = ancestry[path2.length - 1];
  return inPath(node, ancestor, path2);
}
function has(node, selector, _, options2) {
  const collector = [];
  selector.selectors.forEach((childSelector) => {
    traverseChildren(node, (childNode, ancestry) => {
      if (findMatches(childNode, childSelector, ancestry)) {
        collector.push(childNode);
      }
    }, options2);
  });
  return collector.length > 0;
}
function identifier(node, selector) {
  return syntaxKindName(node.kind).toLowerCase() === selector.value.toLowerCase();
}
function matches(modifier) {
  return function(node, selector, ancestry) {
    return selector.selectors[modifier]((childSelector) => {
      return findMatches(node, childSelector, ancestry);
    });
  };
}
function not(node, selector, ancestry) {
  return !selector.selectors.some((childSelector) => {
    return findMatches(node, childSelector, ancestry);
  });
}
function nthChild(node, selector, ancestry) {
  return findMatches(node, selector.right, ancestry) && findNthChild(node, ancestry, () => selector.index.value - 1);
}
function nthLastChild(node, selector, ancestry) {
  return findMatches(node, selector.right, ancestry) && findNthChild(node, ancestry, (length) => length - selector.index.value);
}
function findNthChild(node, ancestry, getIndex) {
  const [parent] = ancestry;
  if (!parent) {
    return false;
  }
  const keys = getVisitorKeys(node.parent || null);
  return keys.some((key) => {
    const prop = node.parent[key];
    if (Array.isArray(prop)) {
      const index = prop.indexOf(node);
      return index >= 0 && index === getIndex(prop.length);
    }
    return false;
  });
}
function sibling(node, selector, ancestry) {
  return findMatches(node, selector.right, ancestry) && findSibling(node, ancestry, siblingLeft) || selector.left.subject && findMatches(node, selector.left, ancestry) && findSibling(node, ancestry, siblingRight);
  function siblingLeft(prop, index) {
    return prop.slice(0, index).some((precedingSibling) => {
      return findMatches(precedingSibling, selector.left, ancestry);
    });
  }
  function siblingRight(prop, index) {
    return prop.slice(index, prop.length).some((followingSibling) => {
      return findMatches(followingSibling, selector.right, ancestry);
    });
  }
}
function adjacent(node, selector, ancestry) {
  return findMatches(node, selector.right, ancestry) && findSibling(node, ancestry, adjacentLeft) || selector.right.subject && findMatches(node, selector.left, ancestry) && findSibling(node, ancestry, adjacentRight);
  function adjacentLeft(prop, index) {
    return index > 0 && findMatches(prop[index - 1], selector.left, ancestry);
  }
  function adjacentRight(prop, index) {
    return index < prop.length - 1 && findMatches(prop[index + 1], selector.right, ancestry);
  }
}
function findSibling(node, ancestry, test) {
  const [parent] = ancestry;
  if (!parent) {
    return false;
  }
  const keys = getVisitorKeys(node.parent || null);
  return keys.some((key) => {
    const prop = node.parent[key];
    if (Array.isArray(prop)) {
      const index = prop.indexOf(node);
      if (index === -1) {
        return false;
      }
      return test(prop, index);
    }
    return false;
  });
}
function wildcard() {
  return true;
}
const MATCHERS = {
  adjacent,
  attribute,
  child,
  compound: matches("every"),
  "class": classs,
  descendant,
  field,
  "nth-child": nthChild,
  "nth-last-child": nthLastChild,
  has,
  identifier,
  matches: matches("some"),
  not,
  sibling,
  wildcard
};
function match(node, selector, options2 = {}) {
  const results = [];
  if (!selector) {
    return results;
  }
  traverseChildren(node, (childNode, ancestry) => {
    if (findMatches(childNode, selector, ancestry, options2)) {
      results.push(childNode);
    }
  }, options2);
  return results;
}
function findMatches(node, selector, ancestry = [], options2 = {}) {
  if (!selector) {
    return true;
  }
  if (!node) {
    return false;
  }
  const matcher = MATCHERS[selector.type];
  if (matcher) {
    return matcher(node, selector, ancestry, options2);
  }
  throw new Error(`Unknown selector type: ${selector.type}`);
}
function e(t2) {
  return (e = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function(e2) {
    return typeof e2;
  } : function(e2) {
    return e2 && "function" == typeof Symbol && e2.constructor === Symbol && e2 !== Symbol.prototype ? "symbol" : typeof e2;
  })(t2);
}
function t(e2, t2) {
  return function(e3) {
    if (Array.isArray(e3))
      return e3;
  }(e2) || function(e3, t3) {
    var r2 = null == e3 ? null : "undefined" != typeof Symbol && e3[Symbol.iterator] || e3["@@iterator"];
    if (null != r2) {
      var n2, a2, o2, i2, s2 = [], u2 = true, l2 = false;
      try {
        if (o2 = (r2 = r2.call(e3)).next, 0 === t3) {
          if (Object(r2) !== r2)
            return;
          u2 = false;
        } else
          for (; !(u2 = (n2 = o2.call(r2)).done) && (s2.push(n2.value), s2.length !== t3); u2 = true)
            ;
      } catch (e4) {
        l2 = true, a2 = e4;
      } finally {
        try {
          if (!u2 && null != r2.return && (i2 = r2.return(), Object(i2) !== i2))
            return;
        } finally {
          if (l2)
            throw a2;
        }
      }
      return s2;
    }
  }(e2, t2) || n(e2, t2) || function() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }();
}
function r(e2) {
  return function(e3) {
    if (Array.isArray(e3))
      return a(e3);
  }(e2) || function(e3) {
    if ("undefined" != typeof Symbol && null != e3[Symbol.iterator] || null != e3["@@iterator"])
      return Array.from(e3);
  }(e2) || n(e2) || function() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }();
}
function n(e2, t2) {
  if (e2) {
    if ("string" == typeof e2)
      return a(e2, t2);
    var r2 = Object.prototype.toString.call(e2).slice(8, -1);
    return "Object" === r2 && e2.constructor && (r2 = e2.constructor.name), "Map" === r2 || "Set" === r2 ? Array.from(e2) : "Arguments" === r2 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r2) ? a(e2, t2) : void 0;
  }
}
function a(e2, t2) {
  (null == t2 || t2 > e2.length) && (t2 = e2.length);
  for (var r2 = 0, n2 = new Array(t2); r2 < t2; r2++)
    n2[r2] = e2[r2];
  return n2;
}
function o(e2, t2) {
  return e2(t2 = { exports: {} }, t2.exports), t2.exports;
}
var i = o(function(e2, t2) {
  !function e3(t3) {
    var r2, n2, a2, o2, i2, s2;
    function u2(e4) {
      var t4, r3, n3 = {};
      for (t4 in e4)
        e4.hasOwnProperty(t4) && (r3 = e4[t4], n3[t4] = "object" == typeof r3 && null !== r3 ? u2(r3) : r3);
      return n3;
    }
    function l2(e4, t4) {
      this.parent = e4, this.key = t4;
    }
    function c2(e4, t4, r3, n3) {
      this.node = e4, this.path = t4, this.wrap = r3, this.ref = n3;
    }
    function f2() {
    }
    function p2(e4) {
      return null != e4 && ("object" == typeof e4 && "string" == typeof e4.type);
    }
    function h2(e4, t4) {
      return (e4 === r2.ObjectExpression || e4 === r2.ObjectPattern) && "properties" === t4;
    }
    function y2(e4, t4) {
      for (var r3 = e4.length - 1; r3 >= 0; --r3)
        if (e4[r3].node === t4)
          return true;
      return false;
    }
    function d2(e4, t4) {
      return new f2().traverse(e4, t4);
    }
    function m2(e4, t4) {
      var r3;
      return r3 = function(e5, t5) {
        var r4, n3, a3, o3;
        for (n3 = e5.length, a3 = 0; n3; )
          t5(e5[o3 = a3 + (r4 = n3 >>> 1)]) ? n3 = r4 : (a3 = o3 + 1, n3 -= r4 + 1);
        return a3;
      }(t4, function(t5) {
        return t5.range[0] > e4.range[0];
      }), e4.extendedRange = [e4.range[0], e4.range[1]], r3 !== t4.length && (e4.extendedRange[1] = t4[r3].range[0]), (r3 -= 1) >= 0 && (e4.extendedRange[0] = t4[r3].range[1]), e4;
    }
    return r2 = { AssignmentExpression: "AssignmentExpression", AssignmentPattern: "AssignmentPattern", ArrayExpression: "ArrayExpression", ArrayPattern: "ArrayPattern", ArrowFunctionExpression: "ArrowFunctionExpression", AwaitExpression: "AwaitExpression", BlockStatement: "BlockStatement", BinaryExpression: "BinaryExpression", BreakStatement: "BreakStatement", CallExpression: "CallExpression", CatchClause: "CatchClause", ChainExpression: "ChainExpression", ClassBody: "ClassBody", ClassDeclaration: "ClassDeclaration", ClassExpression: "ClassExpression", ComprehensionBlock: "ComprehensionBlock", ComprehensionExpression: "ComprehensionExpression", ConditionalExpression: "ConditionalExpression", ContinueStatement: "ContinueStatement", DebuggerStatement: "DebuggerStatement", DirectiveStatement: "DirectiveStatement", DoWhileStatement: "DoWhileStatement", EmptyStatement: "EmptyStatement", ExportAllDeclaration: "ExportAllDeclaration", ExportDefaultDeclaration: "ExportDefaultDeclaration", ExportNamedDeclaration: "ExportNamedDeclaration", ExportSpecifier: "ExportSpecifier", ExpressionStatement: "ExpressionStatement", ForStatement: "ForStatement", ForInStatement: "ForInStatement", ForOfStatement: "ForOfStatement", FunctionDeclaration: "FunctionDeclaration", FunctionExpression: "FunctionExpression", GeneratorExpression: "GeneratorExpression", Identifier: "Identifier", IfStatement: "IfStatement", ImportExpression: "ImportExpression", ImportDeclaration: "ImportDeclaration", ImportDefaultSpecifier: "ImportDefaultSpecifier", ImportNamespaceSpecifier: "ImportNamespaceSpecifier", ImportSpecifier: "ImportSpecifier", Literal: "Literal", LabeledStatement: "LabeledStatement", LogicalExpression: "LogicalExpression", MemberExpression: "MemberExpression", MetaProperty: "MetaProperty", MethodDefinition: "MethodDefinition", ModuleSpecifier: "ModuleSpecifier", NewExpression: "NewExpression", ObjectExpression: "ObjectExpression", ObjectPattern: "ObjectPattern", PrivateIdentifier: "PrivateIdentifier", Program: "Program", Property: "Property", PropertyDefinition: "PropertyDefinition", RestElement: "RestElement", ReturnStatement: "ReturnStatement", SequenceExpression: "SequenceExpression", SpreadElement: "SpreadElement", Super: "Super", SwitchStatement: "SwitchStatement", SwitchCase: "SwitchCase", TaggedTemplateExpression: "TaggedTemplateExpression", TemplateElement: "TemplateElement", TemplateLiteral: "TemplateLiteral", ThisExpression: "ThisExpression", ThrowStatement: "ThrowStatement", TryStatement: "TryStatement", UnaryExpression: "UnaryExpression", UpdateExpression: "UpdateExpression", VariableDeclaration: "VariableDeclaration", VariableDeclarator: "VariableDeclarator", WhileStatement: "WhileStatement", WithStatement: "WithStatement", YieldExpression: "YieldExpression" }, a2 = { AssignmentExpression: ["left", "right"], AssignmentPattern: ["left", "right"], ArrayExpression: ["elements"], ArrayPattern: ["elements"], ArrowFunctionExpression: ["params", "body"], AwaitExpression: ["argument"], BlockStatement: ["body"], BinaryExpression: ["left", "right"], BreakStatement: ["label"], CallExpression: ["callee", "arguments"], CatchClause: ["param", "body"], ChainExpression: ["expression"], ClassBody: ["body"], ClassDeclaration: ["id", "superClass", "body"], ClassExpression: ["id", "superClass", "body"], ComprehensionBlock: ["left", "right"], ComprehensionExpression: ["blocks", "filter", "body"], ConditionalExpression: ["test", "consequent", "alternate"], ContinueStatement: ["label"], DebuggerStatement: [], DirectiveStatement: [], DoWhileStatement: ["body", "test"], EmptyStatement: [], ExportAllDeclaration: ["source"], ExportDefaultDeclaration: ["declaration"], ExportNamedDeclaration: ["declaration", "specifiers", "source"], ExportSpecifier: ["exported", "local"], ExpressionStatement: ["expression"], ForStatement: ["init", "test", "update", "body"], ForInStatement: ["left", "right", "body"], ForOfStatement: ["left", "right", "body"], FunctionDeclaration: ["id", "params", "body"], FunctionExpression: ["id", "params", "body"], GeneratorExpression: ["blocks", "filter", "body"], Identifier: [], IfStatement: ["test", "consequent", "alternate"], ImportExpression: ["source"], ImportDeclaration: ["specifiers", "source"], ImportDefaultSpecifier: ["local"], ImportNamespaceSpecifier: ["local"], ImportSpecifier: ["imported", "local"], Literal: [], LabeledStatement: ["label", "body"], LogicalExpression: ["left", "right"], MemberExpression: ["object", "property"], MetaProperty: ["meta", "property"], MethodDefinition: ["key", "value"], ModuleSpecifier: [], NewExpression: ["callee", "arguments"], ObjectExpression: ["properties"], ObjectPattern: ["properties"], PrivateIdentifier: [], Program: ["body"], Property: ["key", "value"], PropertyDefinition: ["key", "value"], RestElement: ["argument"], ReturnStatement: ["argument"], SequenceExpression: ["expressions"], SpreadElement: ["argument"], Super: [], SwitchStatement: ["discriminant", "cases"], SwitchCase: ["test", "consequent"], TaggedTemplateExpression: ["tag", "quasi"], TemplateElement: [], TemplateLiteral: ["quasis", "expressions"], ThisExpression: [], ThrowStatement: ["argument"], TryStatement: ["block", "handler", "finalizer"], UnaryExpression: ["argument"], UpdateExpression: ["argument"], VariableDeclaration: ["declarations"], VariableDeclarator: ["id", "init"], WhileStatement: ["test", "body"], WithStatement: ["object", "body"], YieldExpression: ["argument"] }, n2 = { Break: o2 = {}, Skip: i2 = {}, Remove: s2 = {} }, l2.prototype.replace = function(e4) {
      this.parent[this.key] = e4;
    }, l2.prototype.remove = function() {
      return Array.isArray(this.parent) ? (this.parent.splice(this.key, 1), true) : (this.replace(null), false);
    }, f2.prototype.path = function() {
      var e4, t4, r3, n3, a3;
      function o3(e5, t5) {
        if (Array.isArray(t5))
          for (r3 = 0, n3 = t5.length; r3 < n3; ++r3)
            e5.push(t5[r3]);
        else
          e5.push(t5);
      }
      if (!this.__current.path)
        return null;
      for (a3 = [], e4 = 2, t4 = this.__leavelist.length; e4 < t4; ++e4)
        o3(a3, this.__leavelist[e4].path);
      return o3(a3, this.__current.path), a3;
    }, f2.prototype.type = function() {
      return this.current().type || this.__current.wrap;
    }, f2.prototype.parents = function() {
      var e4, t4, r3;
      for (r3 = [], e4 = 1, t4 = this.__leavelist.length; e4 < t4; ++e4)
        r3.push(this.__leavelist[e4].node);
      return r3;
    }, f2.prototype.current = function() {
      return this.__current.node;
    }, f2.prototype.__execute = function(e4, t4) {
      var r3, n3;
      return n3 = void 0, r3 = this.__current, this.__current = t4, this.__state = null, e4 && (n3 = e4.call(this, t4.node, this.__leavelist[this.__leavelist.length - 1].node)), this.__current = r3, n3;
    }, f2.prototype.notify = function(e4) {
      this.__state = e4;
    }, f2.prototype.skip = function() {
      this.notify(i2);
    }, f2.prototype.break = function() {
      this.notify(o2);
    }, f2.prototype.remove = function() {
      this.notify(s2);
    }, f2.prototype.__initialize = function(e4, t4) {
      this.visitor = t4, this.root = e4, this.__worklist = [], this.__leavelist = [], this.__current = null, this.__state = null, this.__fallback = null, "iteration" === t4.fallback ? this.__fallback = Object.keys : "function" == typeof t4.fallback && (this.__fallback = t4.fallback), this.__keys = a2, t4.keys && (this.__keys = Object.assign(Object.create(this.__keys), t4.keys));
    }, f2.prototype.traverse = function(e4, t4) {
      var r3, n3, a3, s3, u3, l3, f3, d3, m3, x2, v2, g2;
      for (this.__initialize(e4, t4), g2 = {}, r3 = this.__worklist, n3 = this.__leavelist, r3.push(new c2(e4, null, null, null)), n3.push(new c2(null, null, null, null)); r3.length; )
        if ((a3 = r3.pop()) !== g2) {
          if (a3.node) {
            if (l3 = this.__execute(t4.enter, a3), this.__state === o2 || l3 === o2)
              return;
            if (r3.push(g2), n3.push(a3), this.__state === i2 || l3 === i2)
              continue;
            if (u3 = (s3 = a3.node).type || a3.wrap, !(x2 = this.__keys[u3])) {
              if (!this.__fallback)
                throw new Error("Unknown node type " + u3 + ".");
              x2 = this.__fallback(s3);
            }
            for (d3 = x2.length; (d3 -= 1) >= 0; )
              if (v2 = s3[f3 = x2[d3]]) {
                if (Array.isArray(v2)) {
                  for (m3 = v2.length; (m3 -= 1) >= 0; )
                    if (v2[m3] && !y2(n3, v2[m3])) {
                      if (h2(u3, x2[d3]))
                        a3 = new c2(v2[m3], [f3, m3], "Property", null);
                      else {
                        if (!p2(v2[m3]))
                          continue;
                        a3 = new c2(v2[m3], [f3, m3], null, null);
                      }
                      r3.push(a3);
                    }
                } else if (p2(v2)) {
                  if (y2(n3, v2))
                    continue;
                  r3.push(new c2(v2, f3, null, null));
                }
              }
          }
        } else if (a3 = n3.pop(), l3 = this.__execute(t4.leave, a3), this.__state === o2 || l3 === o2)
          return;
    }, f2.prototype.replace = function(e4, t4) {
      var r3, n3, a3, u3, f3, y3, d3, m3, x2, v2, g2, A2, E;
      function b(e5) {
        var t5, n4, a4, o3;
        if (e5.ref.remove()) {
          for (n4 = e5.ref.key, o3 = e5.ref.parent, t5 = r3.length; t5--; )
            if ((a4 = r3[t5]).ref && a4.ref.parent === o3) {
              if (a4.ref.key < n4)
                break;
              --a4.ref.key;
            }
        }
      }
      for (this.__initialize(e4, t4), g2 = {}, r3 = this.__worklist, n3 = this.__leavelist, y3 = new c2(e4, null, null, new l2(A2 = { root: e4 }, "root")), r3.push(y3), n3.push(y3); r3.length; )
        if ((y3 = r3.pop()) !== g2) {
          if (void 0 !== (f3 = this.__execute(t4.enter, y3)) && f3 !== o2 && f3 !== i2 && f3 !== s2 && (y3.ref.replace(f3), y3.node = f3), this.__state !== s2 && f3 !== s2 || (b(y3), y3.node = null), this.__state === o2 || f3 === o2)
            return A2.root;
          if ((a3 = y3.node) && (r3.push(g2), n3.push(y3), this.__state !== i2 && f3 !== i2)) {
            if (u3 = a3.type || y3.wrap, !(x2 = this.__keys[u3])) {
              if (!this.__fallback)
                throw new Error("Unknown node type " + u3 + ".");
              x2 = this.__fallback(a3);
            }
            for (d3 = x2.length; (d3 -= 1) >= 0; )
              if (v2 = a3[E = x2[d3]])
                if (Array.isArray(v2)) {
                  for (m3 = v2.length; (m3 -= 1) >= 0; )
                    if (v2[m3]) {
                      if (h2(u3, x2[d3]))
                        y3 = new c2(v2[m3], [E, m3], "Property", new l2(v2, m3));
                      else {
                        if (!p2(v2[m3]))
                          continue;
                        y3 = new c2(v2[m3], [E, m3], null, new l2(v2, m3));
                      }
                      r3.push(y3);
                    }
                } else
                  p2(v2) && r3.push(new c2(v2, E, null, new l2(a3, E)));
          }
        } else if (y3 = n3.pop(), void 0 !== (f3 = this.__execute(t4.leave, y3)) && f3 !== o2 && f3 !== i2 && f3 !== s2 && y3.ref.replace(f3), this.__state !== s2 && f3 !== s2 || b(y3), this.__state === o2 || f3 === o2)
          return A2.root;
      return A2.root;
    }, t3.Syntax = r2, t3.traverse = d2, t3.replace = function(e4, t4) {
      return new f2().replace(e4, t4);
    }, t3.attachComments = function(e4, t4, r3) {
      var a3, o3, i3, s3, l3 = [];
      if (!e4.range)
        throw new Error("attachComments needs range information");
      if (!r3.length) {
        if (t4.length) {
          for (i3 = 0, o3 = t4.length; i3 < o3; i3 += 1)
            (a3 = u2(t4[i3])).extendedRange = [0, e4.range[0]], l3.push(a3);
          e4.leadingComments = l3;
        }
        return e4;
      }
      for (i3 = 0, o3 = t4.length; i3 < o3; i3 += 1)
        l3.push(m2(u2(t4[i3]), r3));
      return s3 = 0, d2(e4, { enter: function(e5) {
        for (var t5; s3 < l3.length && !((t5 = l3[s3]).extendedRange[1] > e5.range[0]); )
          t5.extendedRange[1] === e5.range[0] ? (e5.leadingComments || (e5.leadingComments = []), e5.leadingComments.push(t5), l3.splice(s3, 1)) : s3 += 1;
        return s3 === l3.length ? n2.Break : l3[s3].extendedRange[0] > e5.range[1] ? n2.Skip : void 0;
      } }), s3 = 0, d2(e4, { leave: function(e5) {
        for (var t5; s3 < l3.length && (t5 = l3[s3], !(e5.range[1] < t5.extendedRange[0])); )
          e5.range[1] === t5.extendedRange[0] ? (e5.trailingComments || (e5.trailingComments = []), e5.trailingComments.push(t5), l3.splice(s3, 1)) : s3 += 1;
        return s3 === l3.length ? n2.Break : l3[s3].extendedRange[0] > e5.range[1] ? n2.Skip : void 0;
      } }), e4;
    }, t3.VisitorKeys = a2, t3.VisitorOption = n2, t3.Controller = f2, t3.cloneEnvironment = function() {
      return e3({});
    }, t3;
  }(t2);
}), s = o(function(e2) {
  e2.exports && (e2.exports = function() {
    function e3(t2, r2, n2, a2) {
      this.message = t2, this.expected = r2, this.found = n2, this.location = a2, this.name = "SyntaxError", "function" == typeof Error.captureStackTrace && Error.captureStackTrace(this, e3);
    }
    return function(e4, t2) {
      function r2() {
        this.constructor = e4;
      }
      r2.prototype = t2.prototype, e4.prototype = new r2();
    }(e3, Error), e3.buildMessage = function(e4, t2) {
      var r2 = { literal: function(e5) {
        return '"' + a2(e5.text) + '"';
      }, class: function(e5) {
        var t3, r3 = "";
        for (t3 = 0; t3 < e5.parts.length; t3++)
          r3 += e5.parts[t3] instanceof Array ? o2(e5.parts[t3][0]) + "-" + o2(e5.parts[t3][1]) : o2(e5.parts[t3]);
        return "[" + (e5.inverted ? "^" : "") + r3 + "]";
      }, any: function(e5) {
        return "any character";
      }, end: function(e5) {
        return "end of input";
      }, other: function(e5) {
        return e5.description;
      } };
      function n2(e5) {
        return e5.charCodeAt(0).toString(16).toUpperCase();
      }
      function a2(e5) {
        return e5.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(e6) {
          return "\\x0" + n2(e6);
        }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(e6) {
          return "\\x" + n2(e6);
        });
      }
      function o2(e5) {
        return e5.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, function(e6) {
          return "\\x0" + n2(e6);
        }).replace(/[\x10-\x1F\x7F-\x9F]/g, function(e6) {
          return "\\x" + n2(e6);
        });
      }
      return "Expected " + function(e5) {
        var t3, n3, a3, o3 = new Array(e5.length);
        for (t3 = 0; t3 < e5.length; t3++)
          o3[t3] = (a3 = e5[t3], r2[a3.type](a3));
        if (o3.sort(), o3.length > 0) {
          for (t3 = 1, n3 = 1; t3 < o3.length; t3++)
            o3[t3 - 1] !== o3[t3] && (o3[n3] = o3[t3], n3++);
          o3.length = n3;
        }
        switch (o3.length) {
          case 1:
            return o3[0];
          case 2:
            return o3[0] + " or " + o3[1];
          default:
            return o3.slice(0, -1).join(", ") + ", or " + o3[o3.length - 1];
        }
      }(e4) + " but " + function(e5) {
        return e5 ? '"' + a2(e5) + '"' : "end of input";
      }(t2) + " found.";
    }, { SyntaxError: e3, parse: function(t2, r2) {
      r2 = void 0 !== r2 ? r2 : {};
      var n2, a2, o2, i2, s2 = {}, u2 = { start: de }, l2 = de, c2 = ce(" ", false), f2 = /^[^ [\],():#!=><~+.]/, p2 = fe([" ", "[", "]", ",", "(", ")", ":", "#", "!", "=", ">", "<", "~", "+", "."], true, false), h2 = ce(">", false), y2 = ce("~", false), d2 = ce("+", false), m2 = ce(",", false), x2 = ce("!", false), v2 = ce("*", false), g2 = ce("#", false), A2 = ce("[", false), E = ce("]", false), b = /^[><!]/, S = fe([">", "<", "!"], false, false), _ = ce("=", false), C = function(e4) {
        return (e4 || "") + "=";
      }, w = /^[><]/, P = fe([">", "<"], false, false), k = ce(".", false), D = function(e4, t3, r3) {
        return { type: "attribute", name: e4, operator: t3, value: r3 };
      }, I = ce('"', false), j = /^[^\\"]/, T = fe(["\\", '"'], true, false), F = ce("\\", false), R = { type: "any" }, O = function(e4, t3) {
        return e4 + t3;
      }, L = function(e4) {
        return { type: "literal", value: (t3 = e4.join(""), t3.replace(/\\(.)/g, function(e5, t4) {
          switch (t4) {
            case "b":
              return "\b";
            case "f":
              return "\f";
            case "n":
              return "\n";
            case "r":
              return "\r";
            case "t":
              return "	";
            case "v":
              return "\v";
            default:
              return t4;
          }
        })) };
        var t3;
      }, M = ce("'", false), B = /^[^\\']/, U = fe(["\\", "'"], true, false), K = /^[0-9]/, W = fe([["0", "9"]], false, false), V = ce("type(", false), q = /^[^ )]/, N = fe([" ", ")"], true, false), G = ce(")", false), z = /^[imsu]/, H = fe(["i", "m", "s", "u"], false, false), Y = ce("/", false), $ = /^[^\/]/, J = fe(["/"], true, false), Q = ce(":not(", false), X = ce(":matches(", false), Z = ce(":has(", false), ee = ce(":first-child", false), te = ce(":last-child", false), re = ce(":nth-child(", false), ne = ce(":nth-last-child(", false), ae = ce(":", false), oe = 0, ie = [{ line: 1, column: 1 }], se = 0, ue = [], le = {};
      if ("startRule" in r2) {
        if (!(r2.startRule in u2))
          throw new Error(`Can't start parsing from rule "` + r2.startRule + '".');
        l2 = u2[r2.startRule];
      }
      function ce(e4, t3) {
        return { type: "literal", text: e4, ignoreCase: t3 };
      }
      function fe(e4, t3, r3) {
        return { type: "class", parts: e4, inverted: t3, ignoreCase: r3 };
      }
      function pe(e4) {
        var r3, n3 = ie[e4];
        if (n3)
          return n3;
        for (r3 = e4 - 1; !ie[r3]; )
          r3--;
        for (n3 = { line: (n3 = ie[r3]).line, column: n3.column }; r3 < e4; )
          10 === t2.charCodeAt(r3) ? (n3.line++, n3.column = 1) : n3.column++, r3++;
        return ie[e4] = n3, n3;
      }
      function he(e4, t3) {
        var r3 = pe(e4), n3 = pe(t3);
        return { start: { offset: e4, line: r3.line, column: r3.column }, end: { offset: t3, line: n3.line, column: n3.column } };
      }
      function ye(e4) {
        oe < se || (oe > se && (se = oe, ue = []), ue.push(e4));
      }
      function de() {
        var e4, t3, r3, n3, a3 = 30 * oe + 0, o3 = le[a3];
        return o3 ? (oe = o3.nextPos, o3.result) : (e4 = oe, (t3 = me()) !== s2 && (r3 = ge()) !== s2 && me() !== s2 ? e4 = t3 = 1 === (n3 = r3).length ? n3[0] : { type: "matches", selectors: n3 } : (oe = e4, e4 = s2), e4 === s2 && (e4 = oe, (t3 = me()) !== s2 && (t3 = void 0), e4 = t3), le[a3] = { nextPos: oe, result: e4 }, e4);
      }
      function me() {
        var e4, r3, n3 = 30 * oe + 1, a3 = le[n3];
        if (a3)
          return oe = a3.nextPos, a3.result;
        for (e4 = [], 32 === t2.charCodeAt(oe) ? (r3 = " ", oe++) : (r3 = s2, ye(c2)); r3 !== s2; )
          e4.push(r3), 32 === t2.charCodeAt(oe) ? (r3 = " ", oe++) : (r3 = s2, ye(c2));
        return le[n3] = { nextPos: oe, result: e4 }, e4;
      }
      function xe() {
        var e4, r3, n3, a3 = 30 * oe + 2, o3 = le[a3];
        if (o3)
          return oe = o3.nextPos, o3.result;
        if (r3 = [], f2.test(t2.charAt(oe)) ? (n3 = t2.charAt(oe), oe++) : (n3 = s2, ye(p2)), n3 !== s2)
          for (; n3 !== s2; )
            r3.push(n3), f2.test(t2.charAt(oe)) ? (n3 = t2.charAt(oe), oe++) : (n3 = s2, ye(p2));
        else
          r3 = s2;
        return r3 !== s2 && (r3 = r3.join("")), e4 = r3, le[a3] = { nextPos: oe, result: e4 }, e4;
      }
      function ve() {
        var e4, r3, n3, a3 = 30 * oe + 3, o3 = le[a3];
        return o3 ? (oe = o3.nextPos, o3.result) : (e4 = oe, (r3 = me()) !== s2 ? (62 === t2.charCodeAt(oe) ? (n3 = ">", oe++) : (n3 = s2, ye(h2)), n3 !== s2 && me() !== s2 ? e4 = r3 = "child" : (oe = e4, e4 = s2)) : (oe = e4, e4 = s2), e4 === s2 && (e4 = oe, (r3 = me()) !== s2 ? (126 === t2.charCodeAt(oe) ? (n3 = "~", oe++) : (n3 = s2, ye(y2)), n3 !== s2 && me() !== s2 ? e4 = r3 = "sibling" : (oe = e4, e4 = s2)) : (oe = e4, e4 = s2), e4 === s2 && (e4 = oe, (r3 = me()) !== s2 ? (43 === t2.charCodeAt(oe) ? (n3 = "+", oe++) : (n3 = s2, ye(d2)), n3 !== s2 && me() !== s2 ? e4 = r3 = "adjacent" : (oe = e4, e4 = s2)) : (oe = e4, e4 = s2), e4 === s2 && (e4 = oe, 32 === t2.charCodeAt(oe) ? (r3 = " ", oe++) : (r3 = s2, ye(c2)), r3 !== s2 && (n3 = me()) !== s2 ? e4 = r3 = "descendant" : (oe = e4, e4 = s2)))), le[a3] = { nextPos: oe, result: e4 }, e4);
      }
      function ge() {
        var e4, r3, n3, a3, o3, i3, u3, l3, c3 = 30 * oe + 4, f3 = le[c3];
        if (f3)
          return oe = f3.nextPos, f3.result;
        if (e4 = oe, (r3 = Ae()) !== s2) {
          for (n3 = [], a3 = oe, (o3 = me()) !== s2 ? (44 === t2.charCodeAt(oe) ? (i3 = ",", oe++) : (i3 = s2, ye(m2)), i3 !== s2 && (u3 = me()) !== s2 && (l3 = Ae()) !== s2 ? a3 = o3 = [o3, i3, u3, l3] : (oe = a3, a3 = s2)) : (oe = a3, a3 = s2); a3 !== s2; )
            n3.push(a3), a3 = oe, (o3 = me()) !== s2 ? (44 === t2.charCodeAt(oe) ? (i3 = ",", oe++) : (i3 = s2, ye(m2)), i3 !== s2 && (u3 = me()) !== s2 && (l3 = Ae()) !== s2 ? a3 = o3 = [o3, i3, u3, l3] : (oe = a3, a3 = s2)) : (oe = a3, a3 = s2);
          n3 !== s2 ? e4 = r3 = [r3].concat(n3.map(function(e5) {
            return e5[3];
          })) : (oe = e4, e4 = s2);
        } else
          oe = e4, e4 = s2;
        return le[c3] = { nextPos: oe, result: e4 }, e4;
      }
      function Ae() {
        var e4, t3, r3, n3, a3, o3, i3, u3 = 30 * oe + 5, l3 = le[u3];
        if (l3)
          return oe = l3.nextPos, l3.result;
        if (e4 = oe, (t3 = Ee()) !== s2) {
          for (r3 = [], n3 = oe, (a3 = ve()) !== s2 && (o3 = Ee()) !== s2 ? n3 = a3 = [a3, o3] : (oe = n3, n3 = s2); n3 !== s2; )
            r3.push(n3), n3 = oe, (a3 = ve()) !== s2 && (o3 = Ee()) !== s2 ? n3 = a3 = [a3, o3] : (oe = n3, n3 = s2);
          r3 !== s2 ? (i3 = t3, e4 = t3 = r3.reduce(function(e5, t4) {
            return { type: t4[0], left: e5, right: t4[1] };
          }, i3)) : (oe = e4, e4 = s2);
        } else
          oe = e4, e4 = s2;
        return le[u3] = { nextPos: oe, result: e4 }, e4;
      }
      function Ee() {
        var e4, r3, n3, a3, o3, i3, u3, l3 = 30 * oe + 6, c3 = le[l3];
        if (c3)
          return oe = c3.nextPos, c3.result;
        if (e4 = oe, 33 === t2.charCodeAt(oe) ? (r3 = "!", oe++) : (r3 = s2, ye(x2)), r3 === s2 && (r3 = null), r3 !== s2) {
          if (n3 = [], (a3 = be()) !== s2)
            for (; a3 !== s2; )
              n3.push(a3), a3 = be();
          else
            n3 = s2;
          n3 !== s2 ? (o3 = r3, u3 = 1 === (i3 = n3).length ? i3[0] : { type: "compound", selectors: i3 }, o3 && (u3.subject = true), e4 = r3 = u3) : (oe = e4, e4 = s2);
        } else
          oe = e4, e4 = s2;
        return le[l3] = { nextPos: oe, result: e4 }, e4;
      }
      function be() {
        var e4, r3 = 30 * oe + 7, n3 = le[r3];
        return n3 ? (oe = n3.nextPos, n3.result) : ((e4 = function() {
          var e5, r4, n4 = 30 * oe + 8, a3 = le[n4];
          return a3 ? (oe = a3.nextPos, a3.result) : (42 === t2.charCodeAt(oe) ? (r4 = "*", oe++) : (r4 = s2, ye(v2)), r4 !== s2 && (r4 = { type: "wildcard", value: r4 }), e5 = r4, le[n4] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3 = 30 * oe + 9, o3 = le[a3];
          return o3 ? (oe = o3.nextPos, o3.result) : (e5 = oe, 35 === t2.charCodeAt(oe) ? (r4 = "#", oe++) : (r4 = s2, ye(g2)), r4 === s2 && (r4 = null), r4 !== s2 && (n4 = xe()) !== s2 ? e5 = r4 = { type: "identifier", value: n4 } : (oe = e5, e5 = s2), le[a3] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3 = 30 * oe + 10, i3 = le[o3];
          return i3 ? (oe = i3.nextPos, i3.result) : (e5 = oe, 91 === t2.charCodeAt(oe) ? (r4 = "[", oe++) : (r4 = s2, ye(A2)), r4 !== s2 && me() !== s2 && (n4 = function() {
            var e6, r5, n5, a4, o4 = 30 * oe + 14, i4 = le[o4];
            return i4 ? (oe = i4.nextPos, i4.result) : (e6 = oe, (r5 = Se()) !== s2 && me() !== s2 && (n5 = function() {
              var e7, r6, n6, a5 = 30 * oe + 12, o5 = le[a5];
              return o5 ? (oe = o5.nextPos, o5.result) : (e7 = oe, 33 === t2.charCodeAt(oe) ? (r6 = "!", oe++) : (r6 = s2, ye(x2)), r6 === s2 && (r6 = null), r6 !== s2 ? (61 === t2.charCodeAt(oe) ? (n6 = "=", oe++) : (n6 = s2, ye(_)), n6 !== s2 ? (r6 = C(r6), e7 = r6) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2), le[a5] = { nextPos: oe, result: e7 }, e7);
            }()) !== s2 && me() !== s2 ? ((a4 = function() {
              var e7, r6, n6, a5, o5, i5 = 30 * oe + 18, u3 = le[i5];
              if (u3)
                return oe = u3.nextPos, u3.result;
              if (e7 = oe, "type(" === t2.substr(oe, 5) ? (r6 = "type(", oe += 5) : (r6 = s2, ye(V)), r6 !== s2)
                if (me() !== s2) {
                  if (n6 = [], q.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(N)), a5 !== s2)
                    for (; a5 !== s2; )
                      n6.push(a5), q.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(N));
                  else
                    n6 = s2;
                  n6 !== s2 && (a5 = me()) !== s2 ? (41 === t2.charCodeAt(oe) ? (o5 = ")", oe++) : (o5 = s2, ye(G)), o5 !== s2 ? (r6 = { type: "type", value: n6.join("") }, e7 = r6) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2);
                } else
                  oe = e7, e7 = s2;
              else
                oe = e7, e7 = s2;
              return le[i5] = { nextPos: oe, result: e7 }, e7;
            }()) === s2 && (a4 = function() {
              var e7, r6, n6, a5, o5, i5, u3 = 30 * oe + 20, l3 = le[u3];
              if (l3)
                return oe = l3.nextPos, l3.result;
              if (e7 = oe, 47 === t2.charCodeAt(oe) ? (r6 = "/", oe++) : (r6 = s2, ye(Y)), r6 !== s2) {
                if (n6 = [], $.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(J)), a5 !== s2)
                  for (; a5 !== s2; )
                    n6.push(a5), $.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(J));
                else
                  n6 = s2;
                n6 !== s2 ? (47 === t2.charCodeAt(oe) ? (a5 = "/", oe++) : (a5 = s2, ye(Y)), a5 !== s2 ? ((o5 = function() {
                  var e8, r7, n7 = 30 * oe + 19, a6 = le[n7];
                  if (a6)
                    return oe = a6.nextPos, a6.result;
                  if (e8 = [], z.test(t2.charAt(oe)) ? (r7 = t2.charAt(oe), oe++) : (r7 = s2, ye(H)), r7 !== s2)
                    for (; r7 !== s2; )
                      e8.push(r7), z.test(t2.charAt(oe)) ? (r7 = t2.charAt(oe), oe++) : (r7 = s2, ye(H));
                  else
                    e8 = s2;
                  return le[n7] = { nextPos: oe, result: e8 }, e8;
                }()) === s2 && (o5 = null), o5 !== s2 ? (i5 = o5, r6 = { type: "regexp", value: new RegExp(n6.join(""), i5 ? i5.join("") : "") }, e7 = r6) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2);
              } else
                oe = e7, e7 = s2;
              return le[u3] = { nextPos: oe, result: e7 }, e7;
            }()), a4 !== s2 ? (r5 = D(r5, n5, a4), e6 = r5) : (oe = e6, e6 = s2)) : (oe = e6, e6 = s2), e6 === s2 && (e6 = oe, (r5 = Se()) !== s2 && me() !== s2 && (n5 = function() {
              var e7, r6, n6, a5 = 30 * oe + 11, o5 = le[a5];
              return o5 ? (oe = o5.nextPos, o5.result) : (e7 = oe, b.test(t2.charAt(oe)) ? (r6 = t2.charAt(oe), oe++) : (r6 = s2, ye(S)), r6 === s2 && (r6 = null), r6 !== s2 ? (61 === t2.charCodeAt(oe) ? (n6 = "=", oe++) : (n6 = s2, ye(_)), n6 !== s2 ? (r6 = C(r6), e7 = r6) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2), e7 === s2 && (w.test(t2.charAt(oe)) ? (e7 = t2.charAt(oe), oe++) : (e7 = s2, ye(P))), le[a5] = { nextPos: oe, result: e7 }, e7);
            }()) !== s2 && me() !== s2 ? ((a4 = function() {
              var e7, r6, n6, a5, o5, i5, u3 = 30 * oe + 15, l3 = le[u3];
              if (l3)
                return oe = l3.nextPos, l3.result;
              if (e7 = oe, 34 === t2.charCodeAt(oe) ? (r6 = '"', oe++) : (r6 = s2, ye(I)), r6 !== s2) {
                for (n6 = [], j.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(T)), a5 === s2 && (a5 = oe, 92 === t2.charCodeAt(oe) ? (o5 = "\\", oe++) : (o5 = s2, ye(F)), o5 !== s2 ? (t2.length > oe ? (i5 = t2.charAt(oe), oe++) : (i5 = s2, ye(R)), i5 !== s2 ? (o5 = O(o5, i5), a5 = o5) : (oe = a5, a5 = s2)) : (oe = a5, a5 = s2)); a5 !== s2; )
                  n6.push(a5), j.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(T)), a5 === s2 && (a5 = oe, 92 === t2.charCodeAt(oe) ? (o5 = "\\", oe++) : (o5 = s2, ye(F)), o5 !== s2 ? (t2.length > oe ? (i5 = t2.charAt(oe), oe++) : (i5 = s2, ye(R)), i5 !== s2 ? (o5 = O(o5, i5), a5 = o5) : (oe = a5, a5 = s2)) : (oe = a5, a5 = s2));
                n6 !== s2 ? (34 === t2.charCodeAt(oe) ? (a5 = '"', oe++) : (a5 = s2, ye(I)), a5 !== s2 ? (r6 = L(n6), e7 = r6) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2);
              } else
                oe = e7, e7 = s2;
              if (e7 === s2)
                if (e7 = oe, 39 === t2.charCodeAt(oe) ? (r6 = "'", oe++) : (r6 = s2, ye(M)), r6 !== s2) {
                  for (n6 = [], B.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(U)), a5 === s2 && (a5 = oe, 92 === t2.charCodeAt(oe) ? (o5 = "\\", oe++) : (o5 = s2, ye(F)), o5 !== s2 ? (t2.length > oe ? (i5 = t2.charAt(oe), oe++) : (i5 = s2, ye(R)), i5 !== s2 ? (o5 = O(o5, i5), a5 = o5) : (oe = a5, a5 = s2)) : (oe = a5, a5 = s2)); a5 !== s2; )
                    n6.push(a5), B.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(U)), a5 === s2 && (a5 = oe, 92 === t2.charCodeAt(oe) ? (o5 = "\\", oe++) : (o5 = s2, ye(F)), o5 !== s2 ? (t2.length > oe ? (i5 = t2.charAt(oe), oe++) : (i5 = s2, ye(R)), i5 !== s2 ? (o5 = O(o5, i5), a5 = o5) : (oe = a5, a5 = s2)) : (oe = a5, a5 = s2));
                  n6 !== s2 ? (39 === t2.charCodeAt(oe) ? (a5 = "'", oe++) : (a5 = s2, ye(M)), a5 !== s2 ? (r6 = L(n6), e7 = r6) : (oe = e7, e7 = s2)) : (oe = e7, e7 = s2);
                } else
                  oe = e7, e7 = s2;
              return le[u3] = { nextPos: oe, result: e7 }, e7;
            }()) === s2 && (a4 = function() {
              var e7, r6, n6, a5, o5, i5, u3, l3 = 30 * oe + 16, c3 = le[l3];
              if (c3)
                return oe = c3.nextPos, c3.result;
              for (e7 = oe, r6 = oe, n6 = [], K.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(W)); a5 !== s2; )
                n6.push(a5), K.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(W));
              if (n6 !== s2 ? (46 === t2.charCodeAt(oe) ? (a5 = ".", oe++) : (a5 = s2, ye(k)), a5 !== s2 ? r6 = n6 = [n6, a5] : (oe = r6, r6 = s2)) : (oe = r6, r6 = s2), r6 === s2 && (r6 = null), r6 !== s2) {
                if (n6 = [], K.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(W)), a5 !== s2)
                  for (; a5 !== s2; )
                    n6.push(a5), K.test(t2.charAt(oe)) ? (a5 = t2.charAt(oe), oe++) : (a5 = s2, ye(W));
                else
                  n6 = s2;
                n6 !== s2 ? (i5 = n6, u3 = (o5 = r6) ? [].concat.apply([], o5).join("") : "", r6 = { type: "literal", value: parseFloat(u3 + i5.join("")) }, e7 = r6) : (oe = e7, e7 = s2);
              } else
                oe = e7, e7 = s2;
              return le[l3] = { nextPos: oe, result: e7 }, e7;
            }()) === s2 && (a4 = function() {
              var e7, t3, r6 = 30 * oe + 17, n6 = le[r6];
              return n6 ? (oe = n6.nextPos, n6.result) : ((t3 = xe()) !== s2 && (t3 = { type: "literal", value: t3 }), e7 = t3, le[r6] = { nextPos: oe, result: e7 }, e7);
            }()), a4 !== s2 ? (r5 = D(r5, n5, a4), e6 = r5) : (oe = e6, e6 = s2)) : (oe = e6, e6 = s2), e6 === s2 && (e6 = oe, (r5 = Se()) !== s2 && (r5 = { type: "attribute", name: r5 }), e6 = r5)), le[o4] = { nextPos: oe, result: e6 }, e6);
          }()) !== s2 && me() !== s2 ? (93 === t2.charCodeAt(oe) ? (a3 = "]", oe++) : (a3 = s2, ye(E)), a3 !== s2 ? e5 = r4 = n4 : (oe = e5, e5 = s2)) : (oe = e5, e5 = s2), le[o3] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3, i3, u3, l3, c3 = 30 * oe + 21, f3 = le[c3];
          if (f3)
            return oe = f3.nextPos, f3.result;
          if (e5 = oe, 46 === t2.charCodeAt(oe) ? (r4 = ".", oe++) : (r4 = s2, ye(k)), r4 !== s2)
            if ((n4 = xe()) !== s2) {
              for (a3 = [], o3 = oe, 46 === t2.charCodeAt(oe) ? (i3 = ".", oe++) : (i3 = s2, ye(k)), i3 !== s2 && (u3 = xe()) !== s2 ? o3 = i3 = [i3, u3] : (oe = o3, o3 = s2); o3 !== s2; )
                a3.push(o3), o3 = oe, 46 === t2.charCodeAt(oe) ? (i3 = ".", oe++) : (i3 = s2, ye(k)), i3 !== s2 && (u3 = xe()) !== s2 ? o3 = i3 = [i3, u3] : (oe = o3, o3 = s2);
              a3 !== s2 ? (l3 = n4, r4 = { type: "field", name: a3.reduce(function(e6, t3) {
                return e6 + t3[0] + t3[1];
              }, l3) }, e5 = r4) : (oe = e5, e5 = s2);
            } else
              oe = e5, e5 = s2;
          else
            oe = e5, e5 = s2;
          return le[c3] = { nextPos: oe, result: e5 }, e5;
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3 = 30 * oe + 22, i3 = le[o3];
          return i3 ? (oe = i3.nextPos, i3.result) : (e5 = oe, ":not(" === t2.substr(oe, 5) ? (r4 = ":not(", oe += 5) : (r4 = s2, ye(Q)), r4 !== s2 && me() !== s2 && (n4 = ge()) !== s2 && me() !== s2 ? (41 === t2.charCodeAt(oe) ? (a3 = ")", oe++) : (a3 = s2, ye(G)), a3 !== s2 ? e5 = r4 = { type: "not", selectors: n4 } : (oe = e5, e5 = s2)) : (oe = e5, e5 = s2), le[o3] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3 = 30 * oe + 23, i3 = le[o3];
          return i3 ? (oe = i3.nextPos, i3.result) : (e5 = oe, ":matches(" === t2.substr(oe, 9) ? (r4 = ":matches(", oe += 9) : (r4 = s2, ye(X)), r4 !== s2 && me() !== s2 && (n4 = ge()) !== s2 && me() !== s2 ? (41 === t2.charCodeAt(oe) ? (a3 = ")", oe++) : (a3 = s2, ye(G)), a3 !== s2 ? e5 = r4 = { type: "matches", selectors: n4 } : (oe = e5, e5 = s2)) : (oe = e5, e5 = s2), le[o3] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3 = 30 * oe + 24, i3 = le[o3];
          return i3 ? (oe = i3.nextPos, i3.result) : (e5 = oe, ":has(" === t2.substr(oe, 5) ? (r4 = ":has(", oe += 5) : (r4 = s2, ye(Z)), r4 !== s2 && me() !== s2 && (n4 = ge()) !== s2 && me() !== s2 ? (41 === t2.charCodeAt(oe) ? (a3 = ")", oe++) : (a3 = s2, ye(G)), a3 !== s2 ? e5 = r4 = { type: "has", selectors: n4 } : (oe = e5, e5 = s2)) : (oe = e5, e5 = s2), le[o3] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4 = 30 * oe + 25, a3 = le[n4];
          return a3 ? (oe = a3.nextPos, a3.result) : (":first-child" === t2.substr(oe, 12) ? (r4 = ":first-child", oe += 12) : (r4 = s2, ye(ee)), r4 !== s2 && (r4 = _e(1)), e5 = r4, le[n4] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4 = 30 * oe + 26, a3 = le[n4];
          return a3 ? (oe = a3.nextPos, a3.result) : (":last-child" === t2.substr(oe, 11) ? (r4 = ":last-child", oe += 11) : (r4 = s2, ye(te)), r4 !== s2 && (r4 = Ce(1)), e5 = r4, le[n4] = { nextPos: oe, result: e5 }, e5);
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3, i3 = 30 * oe + 27, u3 = le[i3];
          if (u3)
            return oe = u3.nextPos, u3.result;
          if (e5 = oe, ":nth-child(" === t2.substr(oe, 11) ? (r4 = ":nth-child(", oe += 11) : (r4 = s2, ye(re)), r4 !== s2)
            if (me() !== s2) {
              if (n4 = [], K.test(t2.charAt(oe)) ? (a3 = t2.charAt(oe), oe++) : (a3 = s2, ye(W)), a3 !== s2)
                for (; a3 !== s2; )
                  n4.push(a3), K.test(t2.charAt(oe)) ? (a3 = t2.charAt(oe), oe++) : (a3 = s2, ye(W));
              else
                n4 = s2;
              n4 !== s2 && (a3 = me()) !== s2 ? (41 === t2.charCodeAt(oe) ? (o3 = ")", oe++) : (o3 = s2, ye(G)), o3 !== s2 ? (r4 = _e(parseInt(n4.join(""), 10)), e5 = r4) : (oe = e5, e5 = s2)) : (oe = e5, e5 = s2);
            } else
              oe = e5, e5 = s2;
          else
            oe = e5, e5 = s2;
          return le[i3] = { nextPos: oe, result: e5 }, e5;
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3, o3, i3 = 30 * oe + 28, u3 = le[i3];
          if (u3)
            return oe = u3.nextPos, u3.result;
          if (e5 = oe, ":nth-last-child(" === t2.substr(oe, 16) ? (r4 = ":nth-last-child(", oe += 16) : (r4 = s2, ye(ne)), r4 !== s2)
            if (me() !== s2) {
              if (n4 = [], K.test(t2.charAt(oe)) ? (a3 = t2.charAt(oe), oe++) : (a3 = s2, ye(W)), a3 !== s2)
                for (; a3 !== s2; )
                  n4.push(a3), K.test(t2.charAt(oe)) ? (a3 = t2.charAt(oe), oe++) : (a3 = s2, ye(W));
              else
                n4 = s2;
              n4 !== s2 && (a3 = me()) !== s2 ? (41 === t2.charCodeAt(oe) ? (o3 = ")", oe++) : (o3 = s2, ye(G)), o3 !== s2 ? (r4 = Ce(parseInt(n4.join(""), 10)), e5 = r4) : (oe = e5, e5 = s2)) : (oe = e5, e5 = s2);
            } else
              oe = e5, e5 = s2;
          else
            oe = e5, e5 = s2;
          return le[i3] = { nextPos: oe, result: e5 }, e5;
        }()) === s2 && (e4 = function() {
          var e5, r4, n4, a3 = 30 * oe + 29, o3 = le[a3];
          return o3 ? (oe = o3.nextPos, o3.result) : (e5 = oe, 58 === t2.charCodeAt(oe) ? (r4 = ":", oe++) : (r4 = s2, ye(ae)), r4 !== s2 && (n4 = xe()) !== s2 ? e5 = r4 = { type: "class", name: n4 } : (oe = e5, e5 = s2), le[a3] = { nextPos: oe, result: e5 }, e5);
        }()), le[r3] = { nextPos: oe, result: e4 }, e4);
      }
      function Se() {
        var e4, r3, n3, a3, o3, i3, u3, l3, c3 = 30 * oe + 13, f3 = le[c3];
        if (f3)
          return oe = f3.nextPos, f3.result;
        if (e4 = oe, (r3 = xe()) !== s2) {
          for (n3 = [], a3 = oe, 46 === t2.charCodeAt(oe) ? (o3 = ".", oe++) : (o3 = s2, ye(k)), o3 !== s2 && (i3 = xe()) !== s2 ? a3 = o3 = [o3, i3] : (oe = a3, a3 = s2); a3 !== s2; )
            n3.push(a3), a3 = oe, 46 === t2.charCodeAt(oe) ? (o3 = ".", oe++) : (o3 = s2, ye(k)), o3 !== s2 && (i3 = xe()) !== s2 ? a3 = o3 = [o3, i3] : (oe = a3, a3 = s2);
          n3 !== s2 ? (u3 = r3, l3 = n3, e4 = r3 = [].concat.apply([u3], l3).join("")) : (oe = e4, e4 = s2);
        } else
          oe = e4, e4 = s2;
        return le[c3] = { nextPos: oe, result: e4 }, e4;
      }
      function _e(e4) {
        return { type: "nth-child", index: { type: "literal", value: e4 } };
      }
      function Ce(e4) {
        return { type: "nth-last-child", index: { type: "literal", value: e4 } };
      }
      if ((n2 = l2()) !== s2 && oe === t2.length)
        return n2;
      throw n2 !== s2 && oe < t2.length && ye({ type: "end" }), a2 = ue, o2 = se < t2.length ? t2.charAt(se) : null, i2 = se < t2.length ? he(se, se + 1) : he(se, se), new e3(e3.buildMessage(a2, o2), a2, o2, i2);
    } };
  }());
});
function u(e2, t2) {
  for (var r2 = 0; r2 < t2.length; ++r2) {
    if (null == e2)
      return e2;
    e2 = e2[t2[r2]];
  }
  return e2;
}
var l = "function" == typeof WeakMap ? /* @__PURE__ */ new WeakMap() : null;
function c(e2) {
  if (null == e2)
    return function() {
      return true;
    };
  if (null != l) {
    var t2 = l.get(e2);
    return null != t2 || (t2 = f(e2), l.set(e2, t2)), t2;
  }
  return f(e2);
}
function f(t2) {
  switch (t2.type) {
    case "wildcard":
      return function() {
        return true;
      };
    case "identifier":
      var r2 = t2.value.toLowerCase();
      return function(e2, t3, n3) {
        var a3 = n3 && n3.nodeTypeKey || "type";
        return r2 === e2[a3].toLowerCase();
      };
    case "field":
      var n2 = t2.name.split(".");
      return function(e2, t3) {
        return function e3(t4, r3, n3, a3) {
          for (var o3 = r3, i2 = a3; i2 < n3.length; ++i2) {
            if (null == o3)
              return false;
            var s3 = o3[n3[i2]];
            if (Array.isArray(s3)) {
              for (var u2 = 0; u2 < s3.length; ++u2)
                if (e3(t4, s3[u2], n3, i2 + 1))
                  return true;
              return false;
            }
            o3 = s3;
          }
          return t4 === o3;
        }(e2, t3[n2.length - 1], n2, 0);
      };
    case "matches":
      var a2 = t2.selectors.map(c);
      return function(e2, t3, r3) {
        for (var n3 = 0; n3 < a2.length; ++n3)
          if (a2[n3](e2, t3, r3))
            return true;
        return false;
      };
    case "compound":
      var o2 = t2.selectors.map(c);
      return function(e2, t3, r3) {
        for (var n3 = 0; n3 < o2.length; ++n3)
          if (!o2[n3](e2, t3, r3))
            return false;
        return true;
      };
    case "not":
      var s2 = t2.selectors.map(c);
      return function(e2, t3, r3) {
        for (var n3 = 0; n3 < s2.length; ++n3)
          if (s2[n3](e2, t3, r3))
            return false;
        return true;
      };
    case "has":
      var l2 = t2.selectors.map(c);
      return function(e2, t3, r3) {
        var n3 = false, a3 = [];
        return i.traverse(e2, { enter: function(e3, t4) {
          null != t4 && a3.unshift(t4);
          for (var o3 = 0; o3 < l2.length; ++o3)
            if (l2[o3](e3, a3, r3))
              return n3 = true, void this.break();
        }, leave: function() {
          a3.shift();
        }, keys: r3 && r3.visitorKeys, fallback: r3 && r3.fallback || "iteration" }), n3;
      };
    case "child":
      var f2 = c(t2.left), p2 = c(t2.right);
      return function(e2, t3, r3) {
        return !!(t3.length > 0 && p2(e2, t3, r3)) && f2(t3[0], t3.slice(1), r3);
      };
    case "descendant":
      var h2 = c(t2.left), x2 = c(t2.right);
      return function(e2, t3, r3) {
        if (x2(e2, t3, r3)) {
          for (var n3 = 0, a3 = t3.length; n3 < a3; ++n3)
            if (h2(t3[n3], t3.slice(n3 + 1), r3))
              return true;
        }
        return false;
      };
    case "attribute":
      var v2 = t2.name.split(".");
      switch (t2.operator) {
        case void 0:
          return function(e2) {
            return null != u(e2, v2);
          };
        case "=":
          switch (t2.value.type) {
            case "regexp":
              return function(e2) {
                var r3 = u(e2, v2);
                return "string" == typeof r3 && t2.value.value.test(r3);
              };
            case "literal":
              var g2 = "".concat(t2.value.value);
              return function(e2) {
                return g2 === "".concat(u(e2, v2));
              };
            case "type":
              return function(r3) {
                return t2.value.value === e(u(r3, v2));
              };
          }
          throw new Error("Unknown selector value type: ".concat(t2.value.type));
        case "!=":
          switch (t2.value.type) {
            case "regexp":
              return function(e2) {
                return !t2.value.value.test(u(e2, v2));
              };
            case "literal":
              var A2 = "".concat(t2.value.value);
              return function(e2) {
                return A2 !== "".concat(u(e2, v2));
              };
            case "type":
              return function(r3) {
                return t2.value.value !== e(u(r3, v2));
              };
          }
          throw new Error("Unknown selector value type: ".concat(t2.value.type));
        case "<=":
          return function(e2) {
            return u(e2, v2) <= t2.value.value;
          };
        case "<":
          return function(e2) {
            return u(e2, v2) < t2.value.value;
          };
        case ">":
          return function(e2) {
            return u(e2, v2) > t2.value.value;
          };
        case ">=":
          return function(e2) {
            return u(e2, v2) >= t2.value.value;
          };
      }
      throw new Error("Unknown operator: ".concat(t2.operator));
    case "sibling":
      var E = c(t2.left), b = c(t2.right);
      return function(e2, r3, n3) {
        return b(e2, r3, n3) && y(e2, E, r3, "LEFT_SIDE", n3) || t2.left.subject && E(e2, r3, n3) && y(e2, b, r3, "RIGHT_SIDE", n3);
      };
    case "adjacent":
      var S = c(t2.left), _ = c(t2.right);
      return function(e2, r3, n3) {
        return _(e2, r3, n3) && d(e2, S, r3, "LEFT_SIDE", n3) || t2.right.subject && S(e2, r3, n3) && d(e2, _, r3, "RIGHT_SIDE", n3);
      };
    case "nth-child":
      var C = t2.index.value, w = c(t2.right);
      return function(e2, t3, r3) {
        return w(e2, t3, r3) && m(e2, t3, C, r3);
      };
    case "nth-last-child":
      var P = -t2.index.value, k = c(t2.right);
      return function(e2, t3, r3) {
        return k(e2, t3, r3) && m(e2, t3, P, r3);
      };
    case "class":
      return function(e2, r3, n3) {
        if (n3 && n3.matchClass)
          return n3.matchClass(t2.name, e2, r3);
        if (n3 && n3.nodeTypeKey)
          return false;
        switch (t2.name.toLowerCase()) {
          case "statement":
            if ("Statement" === e2.type.slice(-9))
              return true;
          case "declaration":
            return "Declaration" === e2.type.slice(-11);
          case "pattern":
            if ("Pattern" === e2.type.slice(-7))
              return true;
          case "expression":
            return "Expression" === e2.type.slice(-10) || "Literal" === e2.type.slice(-7) || "Identifier" === e2.type && (0 === r3.length || "MetaProperty" !== r3[0].type) || "MetaProperty" === e2.type;
          case "function":
            return "FunctionDeclaration" === e2.type || "FunctionExpression" === e2.type || "ArrowFunctionExpression" === e2.type;
        }
        throw new Error("Unknown class name: ".concat(t2.name));
      };
  }
  throw new Error("Unknown selector type: ".concat(t2.type));
}
function p(e2, t2) {
  var r2 = t2 && t2.nodeTypeKey || "type", n2 = e2[r2];
  return t2 && t2.visitorKeys && t2.visitorKeys[n2] ? t2.visitorKeys[n2] : i.VisitorKeys[n2] ? i.VisitorKeys[n2] : t2 && "function" == typeof t2.fallback ? t2.fallback(e2) : Object.keys(e2).filter(function(e3) {
    return e3 !== r2;
  });
}
function h(t2, r2) {
  var n2 = r2 && r2.nodeTypeKey || "type";
  return null !== t2 && "object" === e(t2) && "string" == typeof t2[n2];
}
function y(e2, r2, n2, a2, o2) {
  var i2 = t(n2, 1)[0];
  if (!i2)
    return false;
  for (var s2 = p(i2, o2), u2 = 0; u2 < s2.length; ++u2) {
    var l2 = i2[s2[u2]];
    if (Array.isArray(l2)) {
      var c2 = l2.indexOf(e2);
      if (c2 < 0)
        continue;
      var f2 = void 0, y2 = void 0;
      "LEFT_SIDE" === a2 ? (f2 = 0, y2 = c2) : (f2 = c2 + 1, y2 = l2.length);
      for (var d2 = f2; d2 < y2; ++d2)
        if (h(l2[d2], o2) && r2(l2[d2], n2, o2))
          return true;
    }
  }
  return false;
}
function d(e2, r2, n2, a2, o2) {
  var i2 = t(n2, 1)[0];
  if (!i2)
    return false;
  for (var s2 = p(i2, o2), u2 = 0; u2 < s2.length; ++u2) {
    var l2 = i2[s2[u2]];
    if (Array.isArray(l2)) {
      var c2 = l2.indexOf(e2);
      if (c2 < 0)
        continue;
      if ("LEFT_SIDE" === a2 && c2 > 0 && h(l2[c2 - 1], o2) && r2(l2[c2 - 1], n2, o2))
        return true;
      if ("RIGHT_SIDE" === a2 && c2 < l2.length - 1 && h(l2[c2 + 1], o2) && r2(l2[c2 + 1], n2, o2))
        return true;
    }
  }
  return false;
}
function m(e2, r2, n2, a2) {
  if (0 === n2)
    return false;
  var o2 = t(r2, 1)[0];
  if (!o2)
    return false;
  for (var i2 = p(o2, a2), s2 = 0; s2 < i2.length; ++s2) {
    var u2 = o2[i2[s2]];
    if (Array.isArray(u2)) {
      var l2 = n2 < 0 ? u2.length + n2 : n2 - 1;
      if (l2 >= 0 && l2 < u2.length && u2[l2] === e2)
        return true;
    }
  }
  return false;
}
function x(t2, n2, a2, o2) {
  if (n2) {
    var s2 = [], u2 = c(n2), l2 = function t3(n3, a3) {
      if (null == n3 || "object" != e(n3))
        return [];
      null == a3 && (a3 = n3);
      for (var o3 = n3.subject ? [a3] : [], i2 = Object.keys(n3), s3 = 0; s3 < i2.length; ++s3) {
        var u3 = i2[s3], l3 = n3[u3];
        o3.push.apply(o3, r(t3(l3, "left" === u3 ? l3 : a3)));
      }
      return o3;
    }(n2).map(c);
    i.traverse(t2, { enter: function(e2, t3) {
      if (null != t3 && s2.unshift(t3), u2(e2, s2, o2))
        if (l2.length)
          for (var r2 = 0, n3 = l2.length; r2 < n3; ++r2) {
            l2[r2](e2, s2, o2) && a2(e2, t3, s2);
            for (var i2 = 0, c2 = s2.length; i2 < c2; ++i2) {
              var f2 = s2.slice(i2 + 1);
              l2[r2](s2[i2], f2, o2) && a2(s2[i2], t3, f2);
            }
          }
        else
          a2(e2, t3, s2);
    }, leave: function() {
      s2.shift();
    }, keys: o2 && o2.visitorKeys, fallback: o2 && o2.fallback || "iteration" });
  }
}
function v(e2, t2, r2) {
  var n2 = [];
  return x(e2, t2, function(e3) {
    n2.push(e3);
  }, r2), n2;
}
function g(e2) {
  return s.parse(e2);
}
function A(e2, t2, r2) {
  return v(e2, g(t2), r2);
}
A.parse = g, A.match = v, A.traverse = x, A.matches = function(e2, t2, r2, n2) {
  return !t2 || !!e2 && (r2 || (r2 = []), c(t2)(e2, r2, n2));
}, A.query = A;
const IDENTIFIER_QUERY = "identifier";
function parse(selector) {
  const cleanSelector = stripComments(stripNewLines(selector));
  return validateParse(A.parse(cleanSelector));
}
function stripComments(selector) {
  return selector.replace(/\/\*[\w\W]*\*\//g, "");
}
function stripNewLines(selector) {
  return selector.replace(/\n/g, "");
}
function validateParse(selector) {
  if (!selector) {
    return selector;
  }
  if (selector.selectors) {
    selector.selectors.map(validateParse);
  }
  if (selector.left) {
    validateParse(selector.left);
  }
  if (selector.right) {
    validateParse(selector.right);
  }
  if (selector.type === IDENTIFIER_QUERY) {
    if (SyntaxKind[selector.value] == null) {
      throw SyntaxError(`"${selector.value}" is not a valid TypeScript Node kind.`);
    }
  }
  return selector;
}
function query(ast, selector, options2 = {}) {
  var _a2;
  if (typeof ast === "string") {
    ast = createAST(ast, void 0, (_a2 = options2.scriptKind) != null ? _a2 : ScriptKind.Unknown);
  }
  return match(ast, parse(selector), options2);
}
function map(ast, selector, nodeTransformer, options2 = {}) {
  const matches2 = query(ast, selector, options2);
  const transformer = createTransformer(matches2, nodeTransformer);
  const [transformed] = transform$1(ast, [transformer]).transformed;
  return transformed;
}
function createTransformer(results, nodeTransformer) {
  return function(context) {
    return function(rootNode) {
      function visit(node) {
        if (results.includes(node)) {
          const replacement = nodeTransformer(node);
          return replacement !== node ? replacement : visitEachChild(node, visit, context);
        }
        return visitEachChild(node, visit, context);
      }
      return visitNode(rootNode, visit);
    };
  };
}
function project(configFilePath) {
  const fullPath = findConfig(configFilePath);
  if (fullPath) {
    return getSourceFiles(fullPath);
  }
  return [];
}
function projectFiles(configFilePath) {
  const fullPath = findConfig(configFilePath);
  if (fullPath) {
    return parseConfig(configFilePath).fileNames;
  }
  return [];
}
function findConfig(configFilePath) {
  try {
    const fullPath = path.resolve(process.cwd(), configFilePath);
    const stats = fs.statSync(fullPath);
    if (!stats.isDirectory()) {
      return fullPath;
    }
    const inDirectoryPath = path.join(fullPath, "tsconfig.json");
    fs.accessSync(inDirectoryPath);
    return inDirectoryPath;
  } catch (e2) {
    return null;
  }
}
function getSourceFiles(configFilePath) {
  const parsed = parseConfig(configFilePath);
  const host = createCompilerHost(parsed.options, true);
  const program = createProgram(parsed.fileNames, parsed.options, host);
  return Array.from(program.getSourceFiles());
}
function parseConfig(configFilePath) {
  const config = readConfigFile(configFilePath, sys.readFile);
  const parseConfigHost = {
    fileExists: fs.existsSync,
    readDirectory: sys.readDirectory,
    readFile: (file) => fs.readFileSync(file, "utf8"),
    useCaseSensitiveFileNames: true
  };
  return parseJsonConfigFileContent(config.config, parseConfigHost, path.dirname(configFilePath), { noEmit: true });
}
function replace(source, selector, stringTransformer, options2 = {}) {
  const matches2 = query(source, selector, options2);
  const replacements = matches2.map((node) => stringTransformer(node));
  const reversedMatches = matches2.reverse();
  const reversedReplacements = replacements.reverse();
  let result = source;
  reversedReplacements.forEach((replacement, index) => {
    if (replacement != null) {
      const match2 = reversedMatches[index];
      result = `${result.substring(0, match2.getStart())}${replacement}${result.substring(match2.getEnd())}`;
    }
  });
  return result;
}
const api = query;
api.ast = createAST;
api.map = map;
api.match = match;
api.parse = parse;
api.project = project;
api.projectFiles = projectFiles;
api.query = query;
api.replace = replace;
api.syntaxKindName = syntaxKindName;
const tsquery = api;
const isInJsx = (node) => {
  const fn2 = (o2) => ts.isJsxElement(o2) || ts.isJsxExpression(o2) || ts.isJsxOpeningElement(o2);
  let p2 = node;
  while (!!p2 && !fn2(p2)) {
    p2 = p2.parent;
  }
  return !!p2 && fn2(p2);
};
const trim = (s2) => s2.substring(1, s2.length - 2);
const visitAllChildren = true;
const transform = (source, scriptKind) => {
  const sourceCode = source != null ? source : `
  export default function TestCode() {
    const [count, setCount] = useState(0);
    const [s, setS] = React.useState(0);
    const arr = useState(null)
    const nor = Math.random

    /* comment */
    function handleClick() {
      setCount(count + 1);
    }

    //comment
    return (
      <div>
        <h1>Counters that update separately</h1>
        <p>{count}</p>
        <button onClick={handleClick}>inc</button>
      </div>
    );
  }
`;
  let nc = fixImport(sourceCode, scriptKind);
  nc = fixUseState(nc, scriptKind);
  nc = fixUseCallback(nc, scriptKind);
  nc = fixUse(nc, "useEffect", scriptKind);
  nc = fixUse(nc, "useMemo", scriptKind);
  nc = fixUseRef(nc, scriptKind);
  nc = nc.replace(/, \)/igm, ")").replace(/,\)/igm, ")");
  return nc;
};
const fixImport = (nc, scriptKind) => tsquery.replace(nc, "ImportDeclaration", (n2) => {
  let nc2 = tsquery.replace(n2.getText(), "ImportSpecifier Identifier[name=useState]", (n22) => "$", { scriptKind });
  nc2 = tsquery.replace(nc2, "ImportSpecifier Identifier[name=useCallback]", (n22) => "$", { scriptKind });
  nc2 = tsquery.replace(nc2, "ImportSpecifier Identifier[name=/(use|create)Ref/]", (n22) => "$", { scriptKind });
  nc2 = tsquery.replace(nc2, "ImportSpecifier Identifier[name=Ref]", (n22) => "Observable", { scriptKind });
  nc2 = tsquery.replace(nc2, "ImportSpecifier Identifier[name=MutableRefObject]", (n22) => "Observable", { scriptKind });
  nc2 = tsquery.replace(nc2, "ImportDeclaration StringLiteral[value=react]", (n22) => "'voby'", { scriptKind });
  const removeSpaces = (s2) => {
    let ss = s2.replace(/  /igm, " ");
    while (ss !== s2) {
      s2 = ss;
      ss = ss.replace(/  /igm, " ");
    }
    return ss;
  };
  nc2 = tsquery.replace(nc2, "NamedImports", (n22) => {
    const t2 = n22.getText();
    const s2 = new Set(t2.slice(1, t2.length - 2).split(","));
    const a2 = [...s2];
    return removeSpaces(`{ ${a2.join(", ")} }`);
  }, { scriptKind });
  return nc2;
}, { scriptKind });
const fnExp = (ce) => {
  var _a2, _b2;
  const ta = ((_a2 = ce.typeArguments) == null ? void 0 : _a2.length) > 0 ? `<${ce.typeArguments.map((a2) => a2.getText()).join(", ")}>` : "";
  const ag = `(${(_b2 = ce.arguments) == null ? void 0 : _b2.map((a2) => a2.getText()).join(", ")})`;
  return `${ta}${ag}`;
};
const fnDep = (ce, keepGeneric = true, removeParenthesis = false) => {
  var _a2;
  const ta = keepGeneric ? ((_a2 = ce.typeArguments) == null ? void 0 : _a2.length) > 0 ? `<${ce.typeArguments.map((a2) => a2.getText()).join(", ")}>` : "" : "";
  const ag = ce.arguments.length === 1 ? removeParenthesis ? `${ce.arguments[0].getText()}` : `(${ce.arguments[0].getText()})` : `(${ce.arguments.slice(0, ce.arguments.length - 1).map((a2) => a2.getText()).join(", ")})`;
  return `${ta}${ag}`;
};
const fixUseState = (nc, scriptKind) => tsquery.replace(nc, "Block", (n2) => {
  const ns = tsquery.query(n2.getText(), "VariableDeclaration CallExpression[expression.name=useState]", { scriptKind });
  const variable = {};
  const keyVal = (fc) => {
    var _a2, _b2, _c, _d, _e;
    let key = (_b2 = (_a2 = fc.getChildAt(1)) == null ? void 0 : _a2.getChildAt(0)) == null ? void 0 : _b2.getText();
    let val = (_e = (_d = (_c = fc.getChildAt(1)) == null ? void 0 : _c.getChildAt(2)) == null ? void 0 : _d.getText()) != null ? _e : "";
    key = key === "" ? val : key;
    return { key, val };
  };
  ns.forEach((n22) => {
    let p2 = n22.parent;
    while (!!p2 && !ts.isVariableDeclaration(p2))
      p2 = p2.parent;
    const fc = p2.getChildAt(0);
    if (ts.isArrayBindingPattern(fc)) {
      const { key, val } = keyVal(fc);
      if (key === "" && val === "")
        ;
      else
        variable[key] = val;
    } else if (ts.isIdentifier(fc))
      variable[fc.getText()] = "";
  });
  let nc2 = n2.getText();
  nc2 = tsquery.replace(nc2, "VariableDeclaration:has(CallExpression[expression.name=useState])", (n22) => {
    const fc = n22.getChildAt(0);
    const { key } = keyVal(fc);
    const id = ts.isArrayBindingPattern(fc) ? fc.elements.length === 0 ? "{}" : key : fc.getText();
    return `${id} = $${fnExp(n22.getChildAt(2))}`;
  }, { scriptKind });
  Object.keys(variable).forEach((k) => {
    nc2 = tsquery.replace(nc2, `ObjectLiteralExpression ShorthandPropertyAssignment[name='${k}']`, (n22) => `${k}: ${k}`, { visitAllChildren: true, scriptKind });
    nc2 = tsquery.replace(nc2, `Identifier[name='${k}']`, (n22) => {
      if (ts.isVariableDeclaration(n22.parent) || isInJsx(n22) || ts.isElementAccessExpression(n22.parent) || ts.isObjectLiteralExpression(n22.parent) || ts.isBindingElement(n22.parent) || ts.isPropertyAssignment(n22.parent))
        return n22.getText();
      return k + "()";
    }, { visitAllChildren: true, scriptKind });
    nc2 = tsquery.replace(nc2, `ElementAccessExpression:has(Identifier[name='${k}'])`, (n22) => {
      if (n22.getChildAt(2).getText() === "0")
        return k + "()";
      else if (n22.getChildAt(2).getText() === "1")
        return k;
      return n22.getText();
    }, { visitAllChildren: true, scriptKind });
    const ro = (nc3) => tsquery.replace(nc3, `ObjectLiteralExpression PropertyAssignment:has(Identifier[name='${k}']) > :last-child`, (n22) => {
      if (ts.isIdentifier(n22))
        return k + "()";
      else if (ts.isObjectLiteralExpression(n22))
        return trim(ro(`(${n22.getText()})`));
      return n22.getText();
    }, { visitAllChildren: true, scriptKind });
    nc2 = ro(nc2);
    if (variable[k]) {
      nc2 = tsquery.replace(nc2, `ShorthandPropertyAssignment Identifier[name=${variable[k]}]`, (n22) => {
        if (ts.isIdentifier(n22))
          return k;
        return k + "()";
      }, { visitAllChildren: true, scriptKind });
      nc2 = tsquery.replace(nc2, `CallExpression Identifier[name='${variable[k]}']`, (n22) => {
        if (ts.isVariableDeclaration(n22.parent))
          return n22.getText();
        return k;
      }, { visitAllChildren: true, scriptKind });
    }
  });
  return nc2;
}, { scriptKind });
const fixUseRef = (nc, scriptKind) => {
  const ns = tsquery.query(nc, "VariableDeclaration CallExpression[expression.name=/(use|create)Ref/]", { scriptKind });
  const variable = {};
  ns.forEach((n2) => {
    let p2 = n2.parent;
    while (!!p2 && !ts.isVariableDeclaration(p2))
      p2 = p2.parent;
    const fc = p2.getChildAt(0);
    variable[fc.getText()] = "";
  });
  let dic = /* @__PURE__ */ new Set();
  nc = tsquery.replace(nc, "VariableDeclaration:has(CallExpression[expression.name=/(use|create)Ref/])", (n2) => {
    const fc = n2.getChildAt(0);
    const id = ts.isArrayBindingPattern(fc) ? fc.getChildAt(1).getChildAt(0).getText() : fc.getText();
    dic.add(id);
    return `${id} = $${fnExp(n2.getChildAt(2))}`;
  }, { scriptKind });
  nc = tsquery.replace(nc, "CallExpression Identifier[name=/(use|create)Ref$/]", (n2) => `$`, { scriptKind });
  nc = tsquery.replace(nc, "BinaryExpression", (n2) => {
    if (ts.isBinaryExpression(n2)) {
      if (ts.isPropertyAccessExpression(n2.left)) {
        if (dic.has(n2.left.getChildAt(0).getText()) && n2.left.getChildAt(2).getText() === "current")
          return `${n2.left.getChildAt(0).getText()}(${n2.right.getText()})`;
      }
    }
    return n2.getText();
  }, { scriptKind });
  const np = (nc2) => tsquery.replace(nc2, "PropertyAccessExpression:has(Identifier[name=current])", (n2) => {
    if (dic.has(n2.expression.getText()) && n2.name.getText() === "current")
      return `${n2.getChildAt(0).getText()}()`;
    else if (ts.isPropertyAccessExpression(n2.expression))
      return np(n2.expression.getText()) + "." + n2.name.getText();
    return n2.getText();
  }, { scriptKind, visitAllChildren });
  nc = np(nc);
  nc = tsquery.replace(nc, "TypeReference Identifier[name=Ref]", (n2) => "Observable", { scriptKind, visitAllChildren });
  nc = tsquery.replace(nc, "TypeReference Identifier[name=MutableRefObject]", (n2) => "Observable", { scriptKind, visitAllChildren });
  return nc;
};
const fixUseCallback = (nc, scriptKind) => {
  nc = tsquery.replace(nc, "Block", (n2) => tsquery.replace(n2.getText(), "VariableDeclaration CallExpression[expression.name=useCallback]", (n22) => {
    return `${fnDep(n22, false, true)}`;
  }, { scriptKind, visitAllChildren }), { scriptKind, visitAllChildren });
  return nc;
};
const fixUse = (nc, hook = "useEffect", scriptKind) => {
  nc = tsquery.replace(nc, `CallExpression[expression.name="${hook}"]`, (n2) => {
    return `${hook}${fnDep(n2)}`;
  }, { scriptKind });
  nc = tsquery.replace(nc, `CallExpression:has(PropertyAccessExpression Identifier[name="${hook}"])`, (n2) => {
    return `${hook}${fnDep(n2)}`;
  }, { scriptKind });
  return nc;
};
const fsp = fs__default.promises;
const pwd = process.cwd();
console.log();
console.log(chalk.underline.bold("Transforming React source to Voby source."));
const options = yargs(process.argv.slice(2)).option("config", {
  alias: "c",
  describe: "Path to configuration file",
  type: "string"
  // demandOption: true, // set this to false if the option is optional
}).help().argv;
if (isPromise(options)) {
  console.error("Unknown promise");
} else {
  const config = (_a = options.config) != null ? _a : "tsconfig.json";
  const cpath = join(pwd, config);
  console.log(chalk.green.bold(`Processing ${cpath}`));
  if (!fs__default.existsSync(cpath))
    console.log(red(`${cpath} not found.`));
  else {
    console.log(green("config: ") + yellow(cpath));
    const cc = JSON.parse(fs__default.readFileSync(cpath).toString());
    const r2 = join(pwd, (_b = cc.compilerOptions.rootDir) != null ? _b : "./");
    const o2 = join(pwd, "./voby");
    console.log(green("rootDir: ") + yellow(r2));
    console.log(green("outDir: ") + yellow(o2));
    const files = sync(["**/*.ts", "**/*.tsx"], { cwd: r2, ignore: cc.exclude });
    console.log();
    console.log(chalk.underline.bold("Files to process:"));
    console.log(files);
    console.log();
    files.forEach((f2) => __async(void 0, null, function* () {
      const src = yield fsp.readFile(join(r2, f2));
      const sk = f2.toLowerCase().endsWith(".tsx") ? ScriptKind.TSX : ScriptKind.TS;
      const ns = transform(src.toString(), sk);
      const of = join(o2, f2);
      const p2 = dirname(of);
      if (!fs__default.existsSync(p2))
        fs__default.mkdirSync(p2, { recursive: true });
      fs__default.writeFileSync(of, ns);
      console.log(green("Done: ") + of + " ✅");
    }));
  }
}
//# sourceMappingURL=react2voby.mjs.map
