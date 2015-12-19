(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/*!
Copyright (C) 2014-2015 by WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
(function(window, document, Object, REGISTER_ELEMENT){'use strict';

// in case it's there or already patched
if (REGISTER_ELEMENT in document) return;

// DO NOT USE THIS FILE DIRECTLY, IT WON'T WORK
// THIS IS A PROJECT BASED ON A BUILD SYSTEM
// THIS FILE IS JUST WRAPPED UP RESULTING IN
// build/document-register-element.js
// and its .max.js counter part

var
  // IE < 11 only + old WebKit for attributes + feature detection
  EXPANDO_UID = '__' + REGISTER_ELEMENT + (Math.random() * 10e4 >> 0),

  // shortcuts and costants
  ATTACHED = 'attached',
  DETACHED = 'detached',
  EXTENDS = 'extends',
  ADDITION = 'ADDITION',
  MODIFICATION = 'MODIFICATION',
  REMOVAL = 'REMOVAL',
  DOM_ATTR_MODIFIED = 'DOMAttrModified',
  DOM_CONTENT_LOADED = 'DOMContentLoaded',
  DOM_SUBTREE_MODIFIED = 'DOMSubtreeModified',
  PREFIX_TAG = '<',
  PREFIX_IS = '=',

  // valid and invalid node names
  validName = /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/,
  invalidNames = [
    'ANNOTATION-XML',
    'COLOR-PROFILE',
    'FONT-FACE',
    'FONT-FACE-SRC',
    'FONT-FACE-URI',
    'FONT-FACE-FORMAT',
    'FONT-FACE-NAME',
    'MISSING-GLYPH'
  ],

  // registered types and their prototypes
  types = [],
  protos = [],

  // to query subnodes
  query = '',

  // html shortcut used to feature detect
  documentElement = document.documentElement,

  // ES5 inline helpers || basic patches
  indexOf = types.indexOf || function (v) {
    for(var i = this.length; i-- && this[i] !== v;){}
    return i;
  },

  // other helpers / shortcuts
  OP = Object.prototype,
  hOP = OP.hasOwnProperty,
  iPO = OP.isPrototypeOf,

  defineProperty = Object.defineProperty,
  gOPD = Object.getOwnPropertyDescriptor,
  gOPN = Object.getOwnPropertyNames,
  gPO = Object.getPrototypeOf,
  sPO = Object.setPrototypeOf,

  // jshint proto: true
  hasProto = !!Object.__proto__,

  // used to create unique instances
  create = Object.create || function Bridge(proto) {
    // silly broken polyfill probably ever used but short enough to work
    return proto ? ((Bridge.prototype = proto), new Bridge()) : this;
  },

  // will set the prototype if possible
  // or copy over all properties
  setPrototype = sPO || (
    hasProto ?
      function (o, p) {
        o.__proto__ = p;
        return o;
      } : (
    (gOPN && gOPD) ?
      (function(){
        function setProperties(o, p) {
          for (var
            key,
            names = gOPN(p),
            i = 0, length = names.length;
            i < length; i++
          ) {
            key = names[i];
            if (!hOP.call(o, key)) {
              defineProperty(o, key, gOPD(p, key));
            }
          }
        }
        return function (o, p) {
          do {
            setProperties(o, p);
          } while ((p = gPO(p)) && !iPO.call(p, o));
          return o;
        };
      }()) :
      function (o, p) {
        for (var key in p) {
          o[key] = p[key];
        }
        return o;
      }
  )),

  // DOM shortcuts and helpers, if any

  MutationObserver = window.MutationObserver ||
                     window.WebKitMutationObserver,

  HTMLElementPrototype = (
    window.HTMLElement ||
    window.Element ||
    window.Node
  ).prototype,

  IE8 = !iPO.call(HTMLElementPrototype, documentElement),

  isValidNode = IE8 ?
    function (node) {
      return node.nodeType === 1;
    } :
    function (node) {
      return iPO.call(HTMLElementPrototype, node);
    },

  targets = IE8 && [],

  cloneNode = HTMLElementPrototype.cloneNode,
  setAttribute = HTMLElementPrototype.setAttribute,
  removeAttribute = HTMLElementPrototype.removeAttribute,

  // replaced later on
  createElement = document.createElement,

  // shared observer for all attributes
  attributesObserver = MutationObserver && {
    attributes: true,
    characterData: true,
    attributeOldValue: true
  },

  // useful to detect only if there's no MutationObserver
  DOMAttrModified = MutationObserver || function(e) {
    doesNotSupportDOMAttrModified = false;
    documentElement.removeEventListener(
      DOM_ATTR_MODIFIED,
      DOMAttrModified
    );
  },

  // will both be used to make DOMNodeInserted asynchronous
  asapQueue,
  rAF = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.msRequestAnimationFrame ||
        function (fn) { setTimeout(fn, 10); },

  // internal flags
  setListener = false,
  doesNotSupportDOMAttrModified = true,
  dropDomContentLoaded = true,

  // needed for the innerHTML helper
  notFromInnerHTMLHelper = true,

  // optionally defined later on
  onSubtreeModified,
  callDOMAttrModified,
  getAttributesMirror,
  observer,

  // based on setting prototype capability
  // will check proto or the expando attribute
  // in order to setup the node once
  patchIfNotAlready,
  patch
;

if (sPO || hasProto) {
    patchIfNotAlready = function (node, proto) {
      if (!iPO.call(proto, node)) {
        setupNode(node, proto);
      }
    };
    patch = setupNode;
} else {
    patchIfNotAlready = function (node, proto) {
      if (!node[EXPANDO_UID]) {
        node[EXPANDO_UID] = Object(true);
        setupNode(node, proto);
      }
    };
    patch = patchIfNotAlready;
}
if (IE8) {
  doesNotSupportDOMAttrModified = false;
  (function (){
    var
      descriptor = gOPD(HTMLElementPrototype, 'addEventListener'),
      addEventListener = descriptor.value,
      patchedRemoveAttribute = function (name) {
        var e = new CustomEvent(DOM_ATTR_MODIFIED, {bubbles: true});
        e.attrName = name;
        e.prevValue = this.getAttribute(name);
        e.newValue = null;
        e[REMOVAL] = e.attrChange = 2;
        removeAttribute.call(this, name);
        this.dispatchEvent(e);
      },
      patchedSetAttribute = function (name, value) {
        var
          had = this.hasAttribute(name),
          old = had && this.getAttribute(name),
          e = new CustomEvent(DOM_ATTR_MODIFIED, {bubbles: true})
        ;
        setAttribute.call(this, name, value);
        e.attrName = name;
        e.prevValue = had ? old : null;
        e.newValue = value;
        if (had) {
          e[MODIFICATION] = e.attrChange = 1;
        } else {
          e[ADDITION] = e.attrChange = 0;
        }
        this.dispatchEvent(e);
      },
      onPropertyChange = function (e) {
        // jshint eqnull:true
        var
          node = e.currentTarget,
          superSecret = node[EXPANDO_UID],
          propertyName = e.propertyName,
          event
        ;
        if (superSecret.hasOwnProperty(propertyName)) {
          superSecret = superSecret[propertyName];
          event = new CustomEvent(DOM_ATTR_MODIFIED, {bubbles: true});
          event.attrName = superSecret.name;
          event.prevValue = superSecret.value || null;
          event.newValue = (superSecret.value = node[propertyName] || null);
          if (event.prevValue == null) {
            event[ADDITION] = event.attrChange = 0;
          } else {
            event[MODIFICATION] = event.attrChange = 1;
          }
          node.dispatchEvent(event);
        }
      }
    ;
    descriptor.value = function (type, handler, capture) {
      if (
        type === DOM_ATTR_MODIFIED &&
        this.attributeChangedCallback &&
        this.setAttribute !== patchedSetAttribute
      ) {
        this[EXPANDO_UID] = {
          className: {
            name: 'class',
            value: this.className
          }
        };
        this.setAttribute = patchedSetAttribute;
        this.removeAttribute = patchedRemoveAttribute;
        addEventListener.call(this, 'propertychange', onPropertyChange);
      }
      addEventListener.call(this, type, handler, capture);
    };
    defineProperty(HTMLElementPrototype, 'addEventListener', descriptor);
  }());
} else if (!MutationObserver) {
  documentElement.addEventListener(DOM_ATTR_MODIFIED, DOMAttrModified);
  documentElement.setAttribute(EXPANDO_UID, 1);
  documentElement.removeAttribute(EXPANDO_UID);
  if (doesNotSupportDOMAttrModified) {
    onSubtreeModified = function (e) {
      var
        node = this,
        oldAttributes,
        newAttributes,
        key
      ;
      if (node === e.target) {
        oldAttributes = node[EXPANDO_UID];
        node[EXPANDO_UID] = (newAttributes = getAttributesMirror(node));
        for (key in newAttributes) {
          if (!(key in oldAttributes)) {
            // attribute was added
            return callDOMAttrModified(
              0,
              node,
              key,
              oldAttributes[key],
              newAttributes[key],
              ADDITION
            );
          } else if (newAttributes[key] !== oldAttributes[key]) {
            // attribute was changed
            return callDOMAttrModified(
              1,
              node,
              key,
              oldAttributes[key],
              newAttributes[key],
              MODIFICATION
            );
          }
        }
        // checking if it has been removed
        for (key in oldAttributes) {
          if (!(key in newAttributes)) {
            // attribute removed
            return callDOMAttrModified(
              2,
              node,
              key,
              oldAttributes[key],
              newAttributes[key],
              REMOVAL
            );
          }
        }
      }
    };
    callDOMAttrModified = function (
      attrChange,
      currentTarget,
      attrName,
      prevValue,
      newValue,
      action
    ) {
      var e = {
        attrChange: attrChange,
        currentTarget: currentTarget,
        attrName: attrName,
        prevValue: prevValue,
        newValue: newValue
      };
      e[action] = attrChange;
      onDOMAttrModified(e);
    };
    getAttributesMirror = function (node) {
      for (var
        attr, name,
        result = {},
        attributes = node.attributes,
        i = 0, length = attributes.length;
        i < length; i++
      ) {
        attr = attributes[i];
        name = attr.name;
        if (name !== 'setAttribute') {
          result[name] = attr.value;
        }
      }
      return result;
    };
  }
}

function loopAndVerify(list, action) {
  for (var i = 0, length = list.length; i < length; i++) {
    verifyAndSetupAndAction(list[i], action);
  }
}

function loopAndSetup(list) {
  for (var i = 0, length = list.length, node; i < length; i++) {
    node = list[i];
    patch(node, protos[getTypeIndex(node)]);
  }
}

function executeAction(action) {
  return function (node) {
    if (isValidNode(node)) {
      verifyAndSetupAndAction(node, action);
      loopAndVerify(
        node.querySelectorAll(query),
        action
      );
    }
  };
}

function getTypeIndex(target) {
  var
    is = target.getAttribute('is'),
    nodeName = target.nodeName.toUpperCase(),
    i = indexOf.call(
      types,
      is ?
          PREFIX_IS + is.toUpperCase() :
          PREFIX_TAG + nodeName
    )
  ;
  return is && -1 < i && !isInQSA(nodeName, is) ? -1 : i;
}

function isInQSA(name, type) {
  return -1 < query.indexOf(name + '[is="' + type + '"]');
}

function onDOMAttrModified(e) {
  var
    node = e.currentTarget,
    attrChange = e.attrChange,
    attrName = e.attrName,
    target = e.target
  ;
  if (notFromInnerHTMLHelper &&
      (!target || target === node) &&
      node.attributeChangedCallback &&
      attrName !== 'style' &
      e.prevValue !== e.newValue) {
    node.attributeChangedCallback(
      attrName,
      attrChange === e[ADDITION] ? null : e.prevValue,
      attrChange === e[REMOVAL] ? null : e.newValue
    );
  }
}

function onDOMNode(action) {
  var executor = executeAction(action);
  return function (e) {
    asapQueue.push(executor, e.target);
  };
}

function onReadyStateChange(e) {
  if (dropDomContentLoaded) {
    dropDomContentLoaded = false;
    e.currentTarget.removeEventListener(DOM_CONTENT_LOADED, onReadyStateChange);
  }
  loopAndVerify(
    (e.target || document).querySelectorAll(query),
    e.detail === DETACHED ? DETACHED : ATTACHED
  );
  if (IE8) purge();
}

function patchedSetAttribute(name, value) {
  // jshint validthis:true
  var self = this;
  setAttribute.call(self, name, value);
  onSubtreeModified.call(self, {target: self});
}

function setupNode(node, proto) {
  setPrototype(node, proto);
  if (observer) {
    observer.observe(node, attributesObserver);
  } else {
    if (doesNotSupportDOMAttrModified) {
      node.setAttribute = patchedSetAttribute;
      node[EXPANDO_UID] = getAttributesMirror(node);
      node.addEventListener(DOM_SUBTREE_MODIFIED, onSubtreeModified);
    }
    node.addEventListener(DOM_ATTR_MODIFIED, onDOMAttrModified);
  }
  if (node.createdCallback && notFromInnerHTMLHelper) {
    node.created = true;
    node.createdCallback();
    node.created = false;
  }
}

function purge() {
  for (var
    node,
    i = 0,
    length = targets.length;
    i < length; i++
  ) {
    node = targets[i];
    if (!documentElement.contains(node)) {
      length--;
      targets.splice(i--, 1);
      verifyAndSetupAndAction(node, DETACHED);
    }
  }
}

function throwTypeError(type) {
  throw new Error('A ' + type + ' type is already registered');
}

function verifyAndSetupAndAction(node, action) {
  var
    fn,
    i = getTypeIndex(node)
  ;
  if (-1 < i) {
    patchIfNotAlready(node, protos[i]);
    i = 0;
    if (action === ATTACHED && !node[ATTACHED]) {
      node[DETACHED] = false;
      node[ATTACHED] = true;
      i = 1;
      if (IE8 && indexOf.call(targets, node) < 0) {
        targets.push(node);
      }
    } else if (action === DETACHED && !node[DETACHED]) {
      node[ATTACHED] = false;
      node[DETACHED] = true;
      i = 1;
    }
    if (i && (fn = node[action + 'Callback'])) fn.call(node);
  }
}

// set as enumerable, writable and configurable
document[REGISTER_ELEMENT] = function registerElement(type, options) {
  upperType = type.toUpperCase();
  if (!setListener) {
    // only first time document.registerElement is used
    // we need to set this listener
    // setting it by default might slow down for no reason
    setListener = true;
    if (MutationObserver) {
      observer = (function(attached, detached){
        function checkEmAll(list, callback) {
          for (var i = 0, length = list.length; i < length; callback(list[i++])){}
        }
        return new MutationObserver(function (records) {
          for (var
            current, node, newValue,
            i = 0, length = records.length; i < length; i++
          ) {
            current = records[i];
            if (current.type === 'childList') {
              checkEmAll(current.addedNodes, attached);
              checkEmAll(current.removedNodes, detached);
            } else {
              node = current.target;
              if (notFromInnerHTMLHelper &&
                  node.attributeChangedCallback &&
                  current.attributeName !== 'style') {
                newValue = node.getAttribute(current.attributeName);
                if (newValue !== current.oldValue) {
                  node.attributeChangedCallback(
                    current.attributeName,
                    current.oldValue,
                    newValue
                  );
                }
              }
            }
          }
        });
      }(executeAction(ATTACHED), executeAction(DETACHED)));
      observer.observe(
        document,
        {
          childList: true,
          subtree: true
        }
      );
    } else {
      asapQueue = [];
      rAF(function ASAP() {
        while (asapQueue.length) {
          asapQueue.shift().call(
            null, asapQueue.shift()
          );
        }
        rAF(ASAP);
      });
      document.addEventListener('DOMNodeInserted', onDOMNode(ATTACHED));
      document.addEventListener('DOMNodeRemoved', onDOMNode(DETACHED));
    }

    document.addEventListener(DOM_CONTENT_LOADED, onReadyStateChange);
    document.addEventListener('readystatechange', onReadyStateChange);

    document.createElement = function (localName, typeExtension) {
      var
        node = createElement.apply(document, arguments),
        name = '' + localName,
        i = indexOf.call(
          types,
          (typeExtension ? PREFIX_IS : PREFIX_TAG) +
          (typeExtension || name).toUpperCase()
        ),
        setup = -1 < i
      ;
      if (typeExtension) {
        node.setAttribute('is', typeExtension = typeExtension.toLowerCase());
        if (setup) {
          setup = isInQSA(name.toUpperCase(), typeExtension);
        }
      }
      notFromInnerHTMLHelper = !document.createElement.innerHTMLHelper;
      if (setup) patch(node, protos[i]);
      return node;
    };

    HTMLElementPrototype.cloneNode = function (deep) {
      var
        node = cloneNode.call(this, !!deep),
        i = getTypeIndex(node)
      ;
      if (-1 < i) patch(node, protos[i]);
      if (deep) loopAndSetup(node.querySelectorAll(query));
      return node;
    };
  }

  if (-2 < (
    indexOf.call(types, PREFIX_IS + upperType) +
    indexOf.call(types, PREFIX_TAG + upperType)
  )) {
    throwTypeError(type);
  }

  if (!validName.test(upperType) || -1 < indexOf.call(invalidNames, upperType)) {
    throw new Error('The type ' + type + ' is invalid');
  }

  var
    constructor = function () {
      return extending ?
        document.createElement(nodeName, upperType) :
        document.createElement(nodeName);
    },
    opt = options || OP,
    extending = hOP.call(opt, EXTENDS),
    nodeName = extending ? options[EXTENDS].toUpperCase() : upperType,
    upperType,
    i
  ;

  if (extending && -1 < (
    indexOf.call(types, PREFIX_TAG + nodeName)
  )) {
    throwTypeError(nodeName);
  }

  i = types.push((extending ? PREFIX_IS : PREFIX_TAG) + upperType) - 1;

  query = query.concat(
    query.length ? ',' : '',
    extending ? nodeName + '[is="' + type.toLowerCase() + '"]' : nodeName
  );

  constructor.prototype = (
    protos[i] = hOP.call(opt, 'prototype') ?
      opt.prototype :
      create(HTMLElementPrototype)
  );

  loopAndVerify(
    document.querySelectorAll(query),
    ATTACHED
  );

  return constructor;
};

}(window, document, Object, 'registerElement'));
},{}],2:[function(require,module,exports){
/*!
Copyright (C) 2014-2015 by WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
// see https://github.com/WebReflection/document-register-element/issues/21#issuecomment-102020311
var innerHTML = (function (document) {

  var
    EXTENDS = 'extends',
    register = document.registerElement,
    div = document.createElement('div'),
    dre = 'document-register-element',
    innerHTML = register.innerHTML,
    initialize,
    registered
  ;

  // avoid duplicated wrappers
  if (innerHTML) return innerHTML;

  try {

    // feature detect the problem
    register.call(
      document,
      dre,
      {prototype: Object.create(
        HTMLElement.prototype,
        {createdCallback: {value: Object}}
      )}
    );

    div.innerHTML = '<' + dre + '></' + dre + '>';

    // if natively supported, nothing to do
    if ('createdCallback' in div.querySelector(dre)) {
      // return just an innerHTML wrap
      return (register.innerHTML = function (el, html) {
        el.innerHTML = html;
        return el;
      });
    }

  } catch(meh) {}

  // in other cases
  registered = [];
  initialize = function (el) {
    if (
      'createdCallback' in el         ||
      'attachedCallback' in el        ||
      'detachedCallback' in el        ||
      'attributeChangedCallback' in el
    ) return;
    document.createElement.innerHTMLHelper = true;
    for (var
      parentNode = el.parentNode,
      type = el.getAttribute('is'),
      name = el.nodeName,
      node = document.createElement.apply(
        document,
        type ? [name, type] : [name]
      ),
      attributes = el.attributes,
      i = 0,
      length = attributes.length,
      attr, fc;
      i < length; i++
    ) {
      attr = attributes[i];
      node.setAttribute(attr.name, attr.value);
    }
    if (node.createdCallback) {
      node.created = true;
      node.createdCallback();
      node.created = false;
    }
    while ((fc = el.firstChild)) node.appendChild(fc);
    document.createElement.innerHTMLHelper = false;
    if (parentNode) parentNode.replaceChild(node, el);
  };
  // augment the document.registerElement method
  return ((document.registerElement = function registerElement(type, options) {
    var name = (options[EXTENDS] ?
      (options[EXTENDS] + '[is="' + type + '"]') : type
    ).toLowerCase();
    if (registered.indexOf(name) < 0) registered.push(name);
    return register.apply(document, arguments);
  }).innerHTML = function (el, html) {
    el.innerHTML = html;
    for (var
      nodes = el.querySelectorAll(registered.join(',')),
      i = nodes.length; i--; initialize(nodes[i])
    ) {}
    return el;
  });
}(document));
},{}],3:[function(require,module,exports){
/*! (C) Andrea Giammarchi - @WebReflection - Mit Style License */
Object.defineProperty(DOMClass,"data",{enumerable:!0,value:{data:function(t,n){"use strict";var r,i="data-dom-class-"+String(t).replace(/([a-z])([A-Z])/g,function(e,t,n){return t+"-"+n.toLowerCase()}).toLowerCase();if(arguments.length!==2)return r=this.getAttribute(i),r==null?r:JSON.parse(r);n==null?this.removeAttribute(i):this.setAttribute(i,JSON.stringify(n))}}});
Object.defineProperty(DOMClass,"bindings",{enumerable:!0,value:function(e){"use strict";function j(e,t,n,r,i){var s,o=T.call(e,t)&&d(e,t).set;return h(e,t,A(function(){return s},function(a){n.nodeValue=s=a,r&&i(t),o&&o.call(e,a)})),n}function F(e,t,n,r,i,s){var o=T.call(e,t)&&d(e,t).set,u=I(n,r);return h(e,t,A(function(){return r},function(f){u=q(n,u,r=f),i&&s(t),o&&o.call(e,f)})),u.fragment}function I(e,t){var n,r;x.innerHTML="<!---->"+t+"<!---->",n={start:x.firstChild,end:x.lastChild,fragment:e.createDocumentFragment()};while(r=x.firstChild)n.fragment.appendChild(r);return n}function q(e,t,n){var r=t.start,i=r.parentNode,s;do s=r.nextSibling,i.removeChild(s);while(s!==t.end);return t=I(e,n),i.replaceChild(t.fragment,r),t}function R(e,t,n,r,i,s,o){var u=null,a=o?null:s.createTextNode("");return i.split(y).forEach(z,{autobots:t,bindings:n,method:e[r],source:e,onUpdate:o?function(e){u=u?q(s,u,e):I(s,e)}:function(e){a.nodeValue=e}}),a||u.fragment}function U(){var e=[],t=0;while(t<arguments.length)e[t]=this[arguments[t++]];return e}function z(e,t,n){var r=this.autobots,i=this.bindings,s=this.source,o=this.method,u=this.onUpdate,a=$(i,s,e).set,f=!!a;r[e]=s[e],h(i,e,A(function(){return r[e]},function(s){r[e]=s,u(o.apply(i,U.apply(r,n))),f&&a.call(i,s)})),u(o.apply(i,U.apply(r,n)))}function W(e,t){var n=e.childNodes,r=n.length,i,s;while(r--)i=n[r],s=i.nodeType,s===3?t.push(i):s===1&&!v.test(i.nodeName)&&W(i,t);return t}function X(e){switch(!0){case typeof e=="number":return e<0?-1:e;case e:return 133;default:return-1}}function V(e,t){h(e,"bindings",{configurable:!0,enumerable:!0,writable:!1,value:t})}function $(e,t,n){var r;return T.call(e,n)?r=d(e,n):(r=d(t,n)||S,r.set&&h(e,n,r)),r}var t=0,n=1,r=2,i=4,s="DOMAttrModified",o="attachedCallback",u="detachedCallback",a="getAttribute",f="setAttribute",l="destroyBindings",c=e.create,h=e.defineProperty,p=e.getPrototypeOf,d=e.getOwnPropertyDescriptor,v=/IFRAME|NOFRAMES|NOSCRIPT|SCRIPT|SELECT|STYLE|TEXTAREA|[a-z]/,m=/\{\{\{?[\S\s]+?\}\}\}?/g,g=/^\{[\S\s]+?\}$/,y=/\s*,\s*/,b=/\s*:\s*/,w=/^\s+|\s+$/g,E=/^([\S]+?)\(([\S\s]*?)\)/,S={attributes:!0,subtree:!0},x=document.createElement("dummy"),T=S.hasOwnProperty,N=function(e,t){return e==null?t:e},C=function(e,t,n){e.addEventListener(t,n,!0)},k=function(e,t,n){e.removeEventListener(t,n,!0)},L=s.trim||function(){return this.replace(w,"")},A=function(e,t){return{configurable:!0,enumerable:!0,get:e,set:t}},O=function(e,t){return typeof t=="function"?function(){return t.apply(e,arguments)}:t},M=function(e,t){var n=e,r;while(n&&!T.call(n,t))n=p(n);if(n){r=d(n,t);if("set"in r&&"get"in r)try{if(r.get.call(e)!==e[t])throw r;return r}catch(i){}}return null},_=window.MutationObserver||window.WebKitMutationObserver||window.MozMutationObserver,D=!!_,P=function(e){return setTimeout(requestAnimationFrame,100,e)},H=clearTimeout,B=D;return B||function(t,n){function r(){B=!0}C(t,s,r),t[f](n,1),t.removeAttribute(n),k(t,s,r)}(document.documentElement,"dom-"+(Math.random()+"-class").slice(2)),{init:function(){(this.template||this.bindings)&&this.createBindings(this)},createBindings:function(e){T.call(this,l)&&this[l](),e.template&&!L.call(this.innerHTML)&&(this.innerHTML=e.template);var p=this,d=p.ownerDocument||d,v=e.bindings||{},w=W(p,[]),x=c(null),I=c(null),q=c(e.bindings||null),U=p.queryAll("[data-bind]"),J=function(e){var t=e.attrName,n=Q;Q=i,q[I[t]]=e.currentTarget[a](t),Q=n},K=!1,Q=t,G=X(e.dispatchBindings||this.dispatchBindings),Y=-1<G,Z=Y&&c(null),et=Y&&function(e){delete Z[e],p.dispatchEvent(new CustomEvent("bindingChanged",{detail:{key:e,value:q[e]}}))},tt=G?function(e){e in Z&&clearTimeout(Z[e]),Z[e]=setTimeout(et,G,e)}:function(e){e in Z&&cancelAnimationFrame(Z[e]),Z[e]=requestAnimationFrame(function(){et(e)})},nt=!1,rt;return h(p,l,{configurable:!0,value:function(){var e;if(nt)return;nt=!0;if(Y)for(e in Z)G?clearTimeout(Z[e]):cancelAnimationFrame(Z[e]),delete Z[e];for(e in x)delete x[e];for(e in I)delete I[e];for(e in q)delete q[e];V(p,{}),K?rt.disconnect():B?U.forEach(function(e){k(e,s,J)}):U.forEach(function(e){delete e[f]})}}),w.forEach(function(e){var t,n,r,i,s,o=0,u=e.nodeValue,a=[],f=[],l=e.parentNode,c;while(r=m.exec(u))i=r.index,s=r[0].length,a.push(u.slice(o,i)),f.push(u.substr(i+2,s-4)),o=i+s;f.length&&(a.push(u.slice(o)),a.forEach(function(i,s){i.length&&l.insertBefore(d.createTextNode(i),e),s<f.length&&(n=L.call(f[s]),t=g.test(n),t&&(n=n.slice(1,-1)),(r=E.exec(n))?l.insertBefore(R(v,x,q,r[1],r[2],d,t),e):($(q,v,n),l.insertBefore(t?F(q,n,d,N(v[n],""),Y,tt):j(q,n,d.createTextNode(N(v[n],"")),Y,tt),e)))}),e.remove())}),U.forEach(function(e){var l=e[f],c=function(t,n){var r=Q;Q=i,l.call(this,t,n),t in I&&this===e&&(q[I[t]]=n),Q=r};e[a]("data-bind").split(y).filter(function(e,t,n){return e.indexOf("(")>0&&e.indexOf(")")<0?(n[t+1]=e+","+n[t+1],!1):!0}).forEach(function(d,m){var g=d.split(b),w=g[0],N=g[1]||w,L=w in e,_=g[1]&&E.exec(N),j,F,R,U,W,X,V;if(_)_[2].split(y).forEach(z,{autobots:x,bindings:q,method:v[_[1]],source:v,onUpdate:L?function(t){e[w]=O(q,t)}:function(t){l.call(e,w,t)}});else{I[w]=N,F=$(q,v,N).set,X=!!F;if(L){T.call(v,N)&&(e[w]=O(q,v[N])),h(q,N,A(function(){return e[w]},function(s){var o=Q;Q=n;switch(o){case t:case i:e[w]=s,Y&&tt(N)}X&&F.call(q,s),Q=o})),j=function(t){if(nt)return k(e,t.type,j);var n=Q;Q=i,q[N]=e[w],Q=n};switch(w){case"value":C(e,"input",j);case"checked":case"selectedIndex":C(e,"change",j)}R=M(e,w),R?(L=T.call(e,w),h(e,w,{configurable:!0,enumerable:R.enumerable,get:R.get,set:function(t){if(nt)return L?h(e,w,R):delete e[w];var n=Q;Q=r,R.set.call(e,t),q[N]=t,Q=n}})):(V=e[w],j=function(){if(nt)return;if(e[w]!==V){var t=Q;Q=r,V=e[w],q[N]=V,Q=t}m=P(j)},U=p[o],W=p[u],h(p,o,{configurable:!0,value:function(){nt||j(H(m)),U&&U.apply(e,arguments)}}),h(p,u,{configurable:!0,value:function(){nt||H(m),W&&W.apply(e,arguments)}}),j())}else T.call(v,N)&&l.call(e,w,v[N]),h(q,N,A(function(){return e[a](w)},function(o){var u=Q;Q=r;switch(u){case t:case n:D?rt.disconnect():B&&k(e,s,J),l.call(e,w,o),Y&&tt(N),D?rt.observe(p,S):B&&C(e,s,J)}X&&F.call(q,o),Q=u})),D?K=!0:B?C(e,s,J):e[f]!==c&&h(e,f,{configurable:!0,value:c})}}),e.removeAttribute("data-bind")}),K&&(rt=new _(function(e){var t=Q;Q=i;for(var n,r,s=0;s<e.length;s++)r=e[s],r.type==="attributes"&&(n=r.attributeName,n!=null&&n in I&&(q[I[n]]=r.target[a](n)));Q=t}),rt.observe(p,S)),V(p,q),p}}}(Object)});
},{}],4:[function(require,module,exports){
(function (global){
/*!
Copyright (C) 2015 by WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
var DOMClass = (function (g, A, O) {'use strict';
  var
    ATTACHED = 'onAttached',
    ATTACHED_CALLBACK = 'attachedCallback',
    CHANGED = 'onChanged',
    CHANGED_CALLBACK = 'attributeChangedCallback',
    CONSTRUCTOR = 'constructor',
    CONSTRUCTOR_CALLBACK = 'createdCallback',
    CSS = 'css',
    STYLE = '<style>',
    DETACHED = 'onDetached',
    DETACHED_CALLBAK = 'detachedCallback',
    EXTENDS = 'extends',
    NAME = 'name',
    hOP = O.hasOwnProperty,
    empty = A.prototype,
    copyOwn = function (source, target) {
      for (var k, p = gOK(source), i = p.length; i--;) {
        k = p[i];
        if (ignore.indexOf(k) < 0 && !hOP.call(target, k)) {
          dP(target, k, gOPD(source, k));
        }
      }
    },
    dP = O.defineProperty,
    gOPD = O.getOwnPropertyDescriptor,
    gOPN = O.getOwnPropertyNames || O.keys || function (o) {
      var a = [], k;
      for (k in o) if (hOP.call(o, k)) a.push(k);
      return a;
    },
    gOPS = O.getOwnPropertySymbols || function () {
      return empty;
    },
    getHTMLConstructor = function (name) {
      return g['HTML' + name + 'Element'];
    },
    gOK = function (obj) {
      return gOPS(obj).concat(gOPN(obj));
    },
    grantArguments = function (el, args) {
      if (!args.length) {
        var attr = el.getAttribute('data-arguments');
        if (attr) {
          args = attr.charAt(0) === '[' ?
            JSON.parse(attr) :
            attr.split(/\s*,\s*/);
        }
      }
      return args;
    },
    ignore = gOK(function () {}),
    setIfThere = function  (where, what, target, alias) {
      if (hOP.call(where, what)) {
        target[alias] = where[what];
      }
    },
    // WUT? https://gist.github.com/WebReflection/4327762cb87a8c634a29
    slice = function slice() {
      for (var
        o = +this,
        i = o,
        l = arguments.length,
        n = l - o,
        a = new A(n < 0 ? 0 : n);
        i < l; i++
      ) a[i - o] = arguments[i];
      return a;
    },
    uid = function (name) {
      return name + '-i-' + (
        hOP.call(uids, name) ? ++uids[name] : (uids[name] = 0)
      );
    },
    lazyStyle = function (el, key, uniqueClassId) {
      var style;
      el.setAttribute('dom-class-uid', uniqueClassId);
      dP(el, CSS, {
        configurable: true,
        get: function () {
          return style || (style = restyle(
            key + '[dom-class-uid="' + uniqueClassId + '"]', {}
          ));
        },
        set: function (info) {
          el[CSS].replace(info);
        }
      });
    },
    uids = {},
    i = 0
  ;
  return function DOMClass(description) {
    var
      CustomElement = function CustomElement() {
        args = slice.apply(0, arguments);
        return new Element();
      },
      args = empty,
      el = {},
      css = hOP.call(description, CSS),
      init = hOP.call(description, CONSTRUCTOR),
      createdCallback = init && description[CONSTRUCTOR],
      Element,
      constructor,
      key, proto, nodeName
    ;
    setIfThere(description, ATTACHED, el, ATTACHED_CALLBACK);
    setIfThere(description, CHANGED, el, CHANGED_CALLBACK);
    setIfThere(description, DETACHED, el, DETACHED_CALLBAK);
    for (key in description) {
      if (hOP.call(description, key)) {
        switch (key) {
          case ATTACHED:
          case CHANGED:
          case CONSTRUCTOR:
          case DETACHED:
          case EXTENDS:
          case NAME:
          case CSS:
            break;
          default:
            el[key] = description[key];
            break;
        }
      }
    }
    el[EXTENDS] = hOP.call(description, EXTENDS) ?
      description[EXTENDS].prototype :
      HTMLElement.prototype
    ;
    if (el[EXTENDS] instanceof HTMLElement) {
      // dumbest thing I've possibly ever written, right here!
      //  Object.getOwnPropertyNames(this).filter((k) => {return k.slice(0, 4)==='HTML'}).map((k)=>{return k.slice(4, -7)}).sort();
      //  ["", "AllCol", "Anchor", "Applet", "Area", "Audio", "BR", "Base", "Body", "Button", "Canvas", "Col", "Content",
      //  "D", "DList", "DataList", "Details", "Dialog", "Directory", "Div", "Embed", "FieldSet", "Font", "Form", "FormControlsCol",
      //  "Frame", "FrameSet", "HR", "Head", "Heading", "Html", "IFrame", "Image", "Input", "Keygen", "LI", "Label", "Legend",
      //  "Link", "Map", "Marquee", "Media", "Menu", "Meta", "Meter", "Mod", "OList", "Object", "OptGroup", "Option", "OptionsCol",
      //  "Output", "Paragraph", "Param", "Picture", "Pre", "Progress", "Quote", "Script", "Select", "Shadow", "Source", "Span",
      //  "Style", "Table", "TableCaption", "TableCell", "TableCol", "TableRow", "TableSection", "Template", "TextArea", "Title",
      //  "Track", "UList", "Unknown", "Video"]
      // but I'll enable only most common one ... please file a bug if you need others
      // also, if you know a way to retrieve a nodeName via its constructor please shout it to me!
      switch (description[EXTENDS]) {
        case getHTMLConstructor('Anchor'): nodeName = 'a'; break;
        case getHTMLConstructor('Audio'): nodeName = 'audio'; break;
        case getHTMLConstructor('BR'): nodeName = 'br'; break;
        case getHTMLConstructor('Body'): nodeName = 'body'; break;
        case getHTMLConstructor('Button'): nodeName = 'button'; break;
        case getHTMLConstructor('Canvas'): nodeName = 'canvas'; break;
        case getHTMLConstructor('Col'): nodeName = 'col'; break;
        case getHTMLConstructor('DataList'): nodeName = 'dl'; break;
        case getHTMLConstructor('Div'): nodeName = 'div'; break;
        case getHTMLConstructor('Form'): nodeName = 'form'; break;
        case getHTMLConstructor('HR'): nodeName = 'hr'; break;
        case getHTMLConstructor('Head'): nodeName = 'head'; break;
        case getHTMLConstructor('IFrame'): nodeName = 'iframe'; break;
        case getHTMLConstructor('Image'): nodeName = 'img'; break;
        case getHTMLConstructor('Input'): nodeName = 'input'; break;
        case getHTMLConstructor('LI'): nodeName = 'li'; break;
        case getHTMLConstructor('Label'): nodeName = 'label'; break;
        case getHTMLConstructor('Legend'): nodeName = 'legend'; break;
        case getHTMLConstructor('Link'): nodeName = 'link'; break;
        case getHTMLConstructor('Menu'): nodeName = 'menu'; break;
        case getHTMLConstructor('OList'): nodeName = 'ol'; break;
        case getHTMLConstructor('Option'): nodeName = 'option'; break;
        case getHTMLConstructor('Paragraph'): nodeName = 'p'; break;
        case getHTMLConstructor('Progress'): nodeName = 'progress'; break;
        case getHTMLConstructor('Quote'): nodeName = 'quote'; break;
        case getHTMLConstructor('Select'): nodeName = 'select'; break;
        case getHTMLConstructor('Span'): nodeName = 'span'; break;
        case getHTMLConstructor('Style'): nodeName = 'style'; break;
        case getHTMLConstructor('Table'): nodeName = 'table'; break;
        case getHTMLConstructor('TableCaption'): nodeName = 'caption'; break;
        case getHTMLConstructor('TableCell'): nodeName = 'td'; break;
        case getHTMLConstructor('TableCol'): nodeName = 'colgroup'; break;
        case getHTMLConstructor('TableRow'): nodeName = 'tr'; break;
        case getHTMLConstructor('TableSection'): nodeName = 'tbody'; break;
        case getHTMLConstructor('Table'): nodeName = 'table'; break;
        case getHTMLConstructor('Table'): nodeName = 'table'; break;
        case getHTMLConstructor('TextArea'): nodeName = 'textarea'; break;
        case getHTMLConstructor('Track'): nodeName = 'track'; break;
        case getHTMLConstructor('UList'): nodeName = 'ul'; break;
        case getHTMLConstructor('Video'): nodeName = 'video'; break;
        // GZIP ALL THE THINGS!
      }
    }
    key = hOP.call(description, NAME) ? description[NAME] : ('x-dom-class-' + i++);
    if (css) el[STYLE] = restyle(key, description[CSS]);
    el[CONSTRUCTOR_CALLBACK] = function () {
      var a = grantArguments(this, args);
      args = empty;
      constructor.apply(this, a);
      if (css) lazyStyle(this, key, uid(key));
      if (init) createdCallback.apply(this, a);
    };
    constructor = new Class(el);
    copyOwn(constructor, CustomElement);
    proto = {prototype: constructor.prototype};
    // if we are extending an HTML element
    // we should retrieve a name and an `is` property
    if (nodeName) proto[EXTENDS] = nodeName;
    Element = document.registerElement(key, proto);
    CustomElement.prototype = Element.prototype;
    dP(Element.prototype, CONSTRUCTOR, {value: CustomElement});
    return CustomElement;
  };
}(this.window || global, Array, Object));
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
/*!
Copyright (C) 2013-2015 by Andrea Giammarchi - @WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
(function(window){'use strict';
  /* jshint loopfunc: true, noempty: false*/
  // http://www.w3.org/TR/dom/#element

  function createDocumentFragment() {
    return document.createDocumentFragment();
  }

  function createElement(nodeName) {
    return document.createElement(nodeName);
  }

  function mutationMacro(nodes) {
    if (nodes.length === 1) {
      return textNodeIfString(nodes[0]);
    }
    for (var
      fragment = createDocumentFragment(),
      list = slice.call(nodes),
      i = 0; i < nodes.length; i++
    ) {
      fragment.appendChild(textNodeIfString(list[i]));
    }
    return fragment;
  }

  function textNodeIfString(node) {
    return typeof node === 'string' ? document.createTextNode(node) : node;
  }

  for(var
    head,
    property,
    TemporaryPrototype,
    TemporaryTokenList,
    wrapVerifyToken,
    document = window.document,
    defineProperty = Object.defineProperty || function (object, property, descriptor) {
      object.__defineGetter__(property, descriptor.get);
    },
    indexOf = [].indexOf || function indexOf(value){
      var length = this.length;
      while(length--) {
        if (this[length] === value) {
          break;
        }
      }
      return length;
    },
    // http://www.w3.org/TR/domcore/#domtokenlist
    verifyToken = function (token) {
      if (!token) {
        throw 'SyntaxError';
      } else if (spaces.test(token)) {
        throw 'InvalidCharacterError';
      }
      return token;
    },
    DOMTokenList = function (node) {
      var
        className = node.className,
        isSVG = typeof className === 'object',
        value = (isSVG ? className.baseVal : className).replace(trim, '')
      ;
      if (value.length) {
        properties.push.apply(
          this,
          value.split(spaces)
        );
      }
      this._isSVG = isSVG;
      this._ = node;
    },
    classListDescriptor = {
      get: function get() {
        return new DOMTokenList(this);
      },
      set: function(){}
    },
    uid = 'dom4-tmp-'.concat(Math.random() * +new Date()).replace('.','-'),
    trim = /^\s+|\s+$/g,
    spaces = /\s+/,
    SPACE = '\x20',
    CLASS_LIST = 'classList',
    toggle = function toggle(token, force) {
      if (this.contains(token)) {
        if (!force) {
          // force is not true (either false or omitted)
          this.remove(token);
        }
      } else if(force === undefined || force) {
        force = true;
        this.add(token);
      }
      return !!force;
    },
    DocumentFragment = window.DocumentFragment,
    Node = window.Node,
    NodePrototype = (Node || Element).prototype,
    CharacterData = window.CharacterData || Node,
    CharacterDataPrototype = CharacterData && CharacterData.prototype,
    DocumentType = window.DocumentType,
    DocumentTypePrototype = DocumentType && DocumentType.prototype,
    ElementPrototype = (window.Element || Node || window.HTMLElement).prototype,
    HTMLSelectElement = window.HTMLSelectElement || createElement('select').constructor,
    selectRemove = HTMLSelectElement.prototype.remove,
    ShadowRoot = window.ShadowRoot,
    SVGElement = window.SVGElement,
    // normalizes multiple ids as CSS query
    idSpaceFinder = / /g,
    idSpaceReplacer = '\\ ',
    createQueryMethod = function (methodName) {
      var createArray = methodName === 'querySelectorAll';
      return function (css) {
        var a, i, id, query, nl, selectors, node = this.parentNode;
        if (node) {
          for (
            id = this.getAttribute('id') || uid,
            query = id === uid ? id : id.replace(idSpaceFinder, idSpaceReplacer),
            selectors = css.split(','),
            i = 0; i < selectors.length; i++
          ) {
            selectors[i] = '#' + query + ' ' + selectors[i];
          }
          css = selectors.join(',');
        }
        if (id === uid) this.setAttribute('id', id);
        nl = (node || this)[methodName](css);
        if (id === uid) this.removeAttribute('id');
        // return a list
        if (createArray) {
          i = nl.length;
          a = new Array(i);
          while (i--) a[i] = nl[i];
        }
        // return node or null
        else {
          a = nl;
        }
        return a;
      };
    },
    addQueryAndAll = function (where) {
      if (!('query' in where)) {
        where.query = ElementPrototype.query;
      }
      if (!('queryAll' in where)) {
        where.queryAll = ElementPrototype.queryAll;
      }
    },
    properties = [
      'matches', (
        ElementPrototype.matchesSelector ||
        ElementPrototype.webkitMatchesSelector ||
        ElementPrototype.khtmlMatchesSelector ||
        ElementPrototype.mozMatchesSelector ||
        ElementPrototype.msMatchesSelector ||
        ElementPrototype.oMatchesSelector ||
        function matches(selector) {
          var parentNode = this.parentNode;
          return !!parentNode && -1 < indexOf.call(
            parentNode.querySelectorAll(selector),
            this
          );
        }
      ),
      'closest', function closest(selector) {
        var parentNode = this, matches;
        while (
          // document has no .matches
          (matches = parentNode && parentNode.matches) &&
          !parentNode.matches(selector)
        ) {
          parentNode = parentNode.parentNode;
        }
        return matches ? parentNode : null;
      },
      'prepend', function prepend() {
        var firstChild = this.firstChild,
            node = mutationMacro(arguments);
        if (firstChild) {
          this.insertBefore(node, firstChild);
        } else {
          this.appendChild(node);
        }
      },
      'append', function append() {
        this.appendChild(mutationMacro(arguments));
      },
      'before', function before() {
        var parentNode = this.parentNode;
        if (parentNode) {
          parentNode.insertBefore(
            mutationMacro(arguments), this
          );
        }
      },
      'after', function after() {
        var parentNode = this.parentNode,
            nextSibling = this.nextSibling,
            node = mutationMacro(arguments);
        if (parentNode) {
          if (nextSibling) {
            parentNode.insertBefore(node, nextSibling);
          } else {
            parentNode.appendChild(node);
          }
        }
      },
      // WARNING - DEPRECATED - use .replaceWith() instead
      'replace', function replace() {
        this.replaceWith.apply(this, arguments);
      },
      'replaceWith', function replaceWith() {
        var parentNode = this.parentNode;
        if (parentNode) {
          parentNode.replaceChild(
            mutationMacro(arguments),
            this
          );
        }
      },
      'remove', function remove() {
        var parentNode = this.parentNode;
        if (parentNode) {
          parentNode.removeChild(this);
        }
      },
      'query', createQueryMethod('querySelector'),
      'queryAll', createQueryMethod('querySelectorAll')
    ],
    slice = properties.slice,
    i = properties.length; i; i -= 2
  ) {
    property = properties[i - 2];
    if (!(property in ElementPrototype)) {
      ElementPrototype[property] = properties[i - 1];
    }
    if (property === 'remove') {
      // see https://github.com/WebReflection/dom4/issues/19
      HTMLSelectElement.prototype[property] = function () {
        return 0 < arguments.length ?
          selectRemove.apply(this, arguments) :
          ElementPrototype.remove.call(this);
      };
    }
    // see https://github.com/WebReflection/dom4/issues/18
    if (/before|after|replace|remove/.test(property)) {
      if (CharacterData && !(property in CharacterDataPrototype)) {
        CharacterDataPrototype[property] = properties[i - 1];
      }
      if (DocumentType && !(property in DocumentTypePrototype)) {
        DocumentTypePrototype[property] = properties[i - 1];
      }
    }
  }

  // bring query and queryAll to the document too
  addQueryAndAll(document);

  // brings query and queryAll to fragments as well
  if (DocumentFragment) {
    addQueryAndAll(DocumentFragment.prototype);
  } else {
    try {
      addQueryAndAll(createDocumentFragment().constructor.prototype);
    } catch(o_O) {}
  }

  // bring query and queryAll to the ShadowRoot too
  if (ShadowRoot) {
    addQueryAndAll(ShadowRoot.prototype);
  }

  // most likely an IE9 only issue
  // see https://github.com/WebReflection/dom4/issues/6
  if (!createElement('a').matches('a')) {
    ElementPrototype[property] = function(matches){
      return function (selector) {
        return matches.call(
          this.parentNode ?
            this :
            createDocumentFragment().appendChild(this),
          selector
        );
      };
    }(ElementPrototype[property]);
  }

  // used to fix both old webkit and SVG
  DOMTokenList.prototype = {
    length: 0,
    add: function add() {
      for(var j = 0, token; j < arguments.length; j++) {
        token = arguments[j];
        if(!this.contains(token)) {
          properties.push.call(this, property);
        }
      }
      if (this._isSVG) {
        this._.setAttribute('class', '' + this);
      } else {
        this._.className = '' + this;
      }
    },
    contains: (function(indexOf){
      return function contains(token) {
        i = indexOf.call(this, property = verifyToken(token));
        return -1 < i;
      };
    }([].indexOf || function (token) {
      i = this.length;
      while(i-- && this[i] !== token){}
      return i;
    })),
    item: function item(i) {
      return this[i] || null;
    },
    remove: function remove() {
      for(var j = 0, token; j < arguments.length; j++) {
        token = arguments[j];
        if(this.contains(token)) {
          properties.splice.call(this, i, 1);
        }
      }
      if (this._isSVG) {
        this._.setAttribute('class', '' + this);
      } else {
        this._.className = '' + this;
      }
    },
    toggle: toggle,
    toString: function toString() {
      return properties.join.call(this, SPACE);
    }
  };

  if (SVGElement && !(CLASS_LIST in SVGElement.prototype)) {
    defineProperty(SVGElement.prototype, CLASS_LIST, classListDescriptor);
  }

  // http://www.w3.org/TR/dom/#domtokenlist
  // iOS 5.1 has completely screwed this property
  // classList in ElementPrototype is false
  // but it's actually there as getter
  if (!(CLASS_LIST in document.documentElement)) {
    defineProperty(ElementPrototype, CLASS_LIST, classListDescriptor);
  } else {
    // iOS 5.1 and Nokia ASHA do not support multiple add or remove
    // trying to detect and fix that in here
    TemporaryTokenList = createElement('div')[CLASS_LIST];
    TemporaryTokenList.add('a', 'b', 'a');
    if ('a\x20b' != TemporaryTokenList) {
      // no other way to reach original methods in iOS 5.1
      TemporaryPrototype = TemporaryTokenList.constructor.prototype;
      if (!('add' in TemporaryPrototype)) {
        // ASHA double fails in here
        TemporaryPrototype = window.TemporaryTokenList.prototype;
      }
      wrapVerifyToken = function (original) {
        return function () {
          var i = 0;
          while (i < arguments.length) {
            original.call(this, arguments[i++]);
          }
        };
      };
      TemporaryPrototype.add = wrapVerifyToken(TemporaryPrototype.add);
      TemporaryPrototype.remove = wrapVerifyToken(TemporaryPrototype.remove);
      // toggle is broken too ^_^ ... let's fix it
      TemporaryPrototype.toggle = toggle;
    }
  }

  if (!('contains' in NodePrototype)) {
    defineProperty(NodePrototype, 'contains', {
      value: function (el) {
        while (el && el !== this) el = el.parentNode;
        return this === el;
      }
    });
  }

  if (!('head' in document)) {
    defineProperty(document, 'head', {
      get: function () {
        return head || (
          head = document.getElementsByTagName('head')[0]
        );
      }
    });
  }

  // requestAnimationFrame partial polyfill
  (function () {
    for (var
      raf,
      rAF = window.requestAnimationFrame,
      cAF = window.cancelAnimationFrame,
      prefixes = ['o', 'ms', 'moz', 'webkit'],
      i = prefixes.length;
      !cAF && i--;
    ) {
      rAF = rAF || window[prefixes[i] + 'RequestAnimationFrame'];
      cAF = window[prefixes[i] + 'CancelAnimationFrame'] ||
            window[prefixes[i] + 'CancelRequestAnimationFrame'];
    }
    if (!cAF) {
      // some FF apparently implemented rAF but no cAF 
      if (rAF) {
        raf = rAF;
        rAF = function (callback) {
          var goOn = true;
          raf(function () {
            if (goOn) callback.apply(this, arguments);
          });
          return function () {
            goOn = false;
          };
        };
        cAF = function (id) {
          id();
        };
      } else {
        rAF = function (callback) {
          return setTimeout(callback, 15, 15);
        };
        cAF = function (id) {
          clearTimeout(id);
        };
      }
    }
    window.requestAnimationFrame = rAF;
    window.cancelAnimationFrame = cAF;
  }());

  // http://www.w3.org/TR/dom/#customevent
  try{new window.CustomEvent('?');}catch(o_O){
    window.CustomEvent = function(
      eventName,
      defaultInitDict
    ){

      // the infamous substitute
      function CustomEvent(type, eventInitDict) {
        /*jshint eqnull:true */
        var event = document.createEvent(eventName);
        if (typeof type != 'string') {
          throw new Error('An event name must be provided');
        }
        if (eventName == 'Event') {
          event.initCustomEvent = initCustomEvent;
        }
        if (eventInitDict == null) {
          eventInitDict = defaultInitDict;
        }
        event.initCustomEvent(
          type,
          eventInitDict.bubbles,
          eventInitDict.cancelable,
          eventInitDict.detail
        );
        return event;
      }

      // attached at runtime
      function initCustomEvent(
        type, bubbles, cancelable, detail
      ) {
        /*jshint validthis:true*/
        this.initEvent(type, bubbles, cancelable);
        this.detail = detail;
      }

      // that's it
      return CustomEvent;
    }(
      // is this IE9 or IE10 ?
      // where CustomEvent is there
      // but not usable as construtor ?
      window.CustomEvent ?
        // use the CustomEvent interface in such case
        'CustomEvent' : 'Event',
        // otherwise the common compatible one
      {
        bubbles: false,
        cancelable: false,
        detail: null
      }
    );
  }

}(window));
},{}],6:[function(require,module,exports){
/*!
Copyright (C) 2015 by Andrea Giammarchi - @WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
var Class = Class || (function (Object) {
  'use strict';

  /*! (C) Andrea Giammarchi - MIT Style License */

  var
    // shortcuts for minifiers and ES3 private keywords too
    CONSTRUCTOR = 'constructor',
    EXTENDS = 'extends',
    IMPLEMENTS = 'implements',
    INIT = 'init',
    PROTOTYPE = 'prototype',
    STATIC = 'static',
    SUPER = 'super',
    TO_STRING = 'toString',
    VALUE = 'value',
    WITH = 'with',

    // infamous property used as fallback
    // for IE8 and lower only
    PROTO = '__proto__',

    // used to copy non enumerable properties on IE
    nonEnumerables = [
      'hasOwnProperty',
      'isPrototypeOf',
      'propertyIsEnumerable',
      'toLocaleString',
      TO_STRING,
      'valueOf'
    ],

    // common shortcuts
    ObjectPrototype = Object[PROTOTYPE],
    hOP = ObjectPrototype[nonEnumerables[0]],
    toString = ObjectPrototype[TO_STRING],

    // Espruino 1.7x does not have (yet) Object.prototype.propertyIsEnumerable
    propertyIsEnumerable = ObjectPrototype[nonEnumerables[2]] || function (p) {
      for (var k in this) if (p === k) return hOP.call(this, p);
      return false;
    },

    // IE < 9 bug only
    hasIEEnumerableBug = !propertyIsEnumerable.call({toString: 0}, TO_STRING),

    // basic ad-hoc private fallback for old browsers
    // use es5-shim if you want a properly patched polyfill
    create = Object.create || function (proto) {
      /*jshint newcap: false */
      var isInstance = this instanceof create;
      create[PROTOTYPE] = isInstance ? createPrototype : (proto || ObjectPrototype);
      return isInstance ? this : new create();
    },

    // very old browsers actually work better
    // without assigning null as prototype
    createPrototype = create[PROTOTYPE],

    // redefined if not present
    defineProperty = Object.defineProperty,

    // redefined if not present
    gOPD = Object.getOwnPropertyDescriptor,

    // basic ad-hoc private fallback for old browsers
    // use es5-shim if you want a properly patched polyfill
    gOPN = Object.getOwnPropertyNames || function (object) {
        var names = [], i, key;
        for (key in object) {
          if (hOP.call(object, key)) {
            names.push(key);
          }
        }
        if (hasIEEnumerableBug) {
          for (i = 0; i < nonEnumerables.length; i++) {
            key = nonEnumerables[i];
            if (hOP.call(object, key)) {
              names.push(key);
            }
          }
        }
        return names;
    },

    // basic ad-hoc private fallback for old browsers
    // returns empty Array if nonexistent
    gOPS = Object.getOwnPropertySymbols || function () {
      return [];
    },

    // needed to verify the existence
    getPrototypeOf = Object.getPrototypeOf,

    // needed to allow Classes as traits
    gPO = getPrototypeOf || function (o) {
      return o[PROTO] || null;
    },

    // equivalent of Reflect.ownKeys
    oK = function (o) {
      return gOPN(o).concat(gOPS(o));
    },

    // used to filter mixin  Symbol
    isArray = Array.isArray || function (a) {
      return toString.call(a) === '[object Array]';
    },

    // used to avoid setting `arguments` and other function properties
    // when public static are copied over
    nativeFunctionOPN = gOPN(function () {}).concat('arguments'),
    indexOf = nativeFunctionOPN.indexOf || function (v) {
      for (var i = this.length; i-- && this[i] !== v;) {}
      return i;
    },

    // used to flag classes
    isClassDescriptor = {value: true},

    trustSuper = ('' + function () {
      // this test should never be minifier sensitive
      // or the indexOf check after will fail
      this['super']();
    }).indexOf(SUPER) < 0 ?
      // In 2010 Opera 10.5 for Linux Debian 6
      // goes nut with methods to string representation,
      // truncating pieces of text in an unpredictable way.
      // If you are targeting such browser
      // be aware that super invocation might fail.
      // This is the only exception I could find
      // from year 2000 to modern days browsers
      // plus everything else would work just fine.
      function () { return true; } :
      // all other JS engines should be just fine
      function (method) {
        var
          str = '' + method,
          i = str.indexOf(SUPER)
        ;
        return i < 0 ?
          false :
          isBoundary(str.charCodeAt(i - 1)) &&
          isBoundary(str.charCodeAt(i + 5));
      }
  ;

  // verified broken IE8 or older browsers
  try {
    defineProperty({}, '{}', {});
  } catch(o_O) {
    if ('__defineGetter__' in {}) {
      defineProperty = function (object, name, descriptor) {
        if (hOP.call(descriptor, VALUE)) {
          object[name] = descriptor[VALUE];
        } else {
          if (hOP.call(descriptor, 'get')) {
            object.__defineGetter__(name, descriptor.get);
          }
          if (hOP.call(descriptor, 'set')) {
            object.__defineSetter__(name, descriptor.set);
          }
        }
        return object;
      };
      gOPD = function (object, key) {
        var
          get = object.__lookupGetter__(key),
          set = object.__lookupSetter__(key),
          descriptor = {}
        ;
        if (get || set) {
          if (get) {
            descriptor.get = get;
          }
          if (set) {
            descriptor.set = set;
          }
        } else {
          descriptor[VALUE] = object[key];
        }
        return descriptor;
      };
    } else {
      defineProperty = function (object, name, descriptor) {
        object[name] = descriptor[VALUE];
        return object;
      };
      gOPD = function (object, key) {
        return {value: object[key]};
      };
    }
  }

  // copy all imported enumerable methods and properties
  function addMixins(mixins, target, inherits, isNOTExtendingNative) {
    for (var
      source,
      init = [],
      i = 0; i < mixins.length; i++
    ) {
      source = transformMixin(mixins[i]);
      if (hOP.call(source, INIT)) {
        init.push(source[INIT]);
      }
      copyOwn(source, target, inherits, false, false, isNOTExtendingNative);
    }
    return init;
  }

  // deep copy all properties of an object (static objects only)
  function copyDeep(source) {
    for (var
      key, descriptor, value,
      target = create(gPO(source)),
      names = oK(source),
      i = 0; i < names.length; i++
    ) {
      key = names[i];
      descriptor = gOPD(source, key);
      if (hOP.call(descriptor, VALUE)) {
        copyValueIfObject(descriptor, copyDeep);
      }
      defineProperty(target, key, descriptor);
    }
    return target;
  }

  // given two objects, performs a deep copy
  // per each property not present in the target
  // otherwise merges, without overwriting,
  // all properties within the object
  function copyMerged(source, target) {
    for (var
      key, descriptor, value, tvalue,
      names = oK(source),
      i = 0; i < names.length; i++
    ) {
      key = names[i];
      descriptor = gOPD(source, key);
      // target already has this property
      if (hOP.call(target, key)) {
        // verify the descriptor can  be merged
        if (hOP.call(descriptor, VALUE)) {
          value = descriptor[VALUE];
          // which means, verify it's an object
          if (isObject(value)) {
            // in such case, verify the target can be modified
            descriptor = gOPD(target, key);
            // meaning verify it's a data descriptor
            if (hOP.call(descriptor, VALUE)) {
              tvalue = descriptor[VALUE];
              // and it's actually an object
              if (isObject(tvalue)) {
                copyMerged(value, tvalue);
              }
            }
          }
        }
      } else {
        // target has no property at all
        if (hOP.call(descriptor, VALUE)) {
          // copy deep if it's an object
          copyValueIfObject(descriptor, copyDeep);
        }
        defineProperty(target, key, descriptor);
      }
    }
  }

  // configure source own properties in the target
  function copyOwn(source, target, inherits, publicStatic, allowInit, isNOTExtendingNative) {
    for (var
      key,
      noFunctionCheck = typeof source !== 'function',
      names = oK(source),
      i = 0; i < names.length; i++
    ) {
      key = names[i];
      if (
        (noFunctionCheck || indexOf.call(nativeFunctionOPN, key) < 0) &&
        isNotASpecialKey(key, allowInit)
      ) {
        if (hOP.call(target, key)) {
          warn('duplicated: ' + key.toString());
        }
        setProperty(inherits, target, key, gOPD(source, key), publicStatic, isNOTExtendingNative);
      }
    }
  }

  // shortcut to copy objects into descriptor.value
  function copyValueIfObject(where, how) {
    var what = where[VALUE];
    if (isObject(what)) {
      where[VALUE] = how(what);
    }
  }


  // return the right constructor analyzing the parent.
  // if the parent is empty there is no need to call it.
  function createConstructor(hasParentPrototype, parent) {
    var Class = function Class() {};
    return hasParentPrototype && ('' + parent) !== ('' + Class) ?
      function Class() {
        return parent.apply(this, arguments);
      } :
      Class
    ;
  }

  // common defineProperty wrapper
  function define(target, key, value, publicStatic) {
    var configurable = isConfigurable(key, publicStatic);
    defineProperty(target, key, {
      enumerable: false, // was: publicStatic,
      configurable: configurable,
      writable: configurable,
      value: value
    });
  }

  // verifies a specific char code is not in [A-Za-z_]
  // used to avoid RegExp for non RegExp aware environment
  function isBoundary(code) {
    return code ?
      (code < 65 || 90 < code) &&
      (code < 97 || 122 < code) &&
      code !== 95 :
      true;
  }

  // if key is UPPER_CASE and the property is public static
  // it will define the property as non configurable and non writable
  function isConfigurable(key, publicStatic) {
    return publicStatic ? !isPublicStatic(key) : true;
  }

  // verifies a key is not special for the class
  function isNotASpecialKey(key, allowInit) {
    return  key !== CONSTRUCTOR &&
            key !== EXTENDS &&
            key !== IMPLEMENTS &&
            // Blackberry 7 and old WebKit bug only:
            //  user defined functions have
            //  enumerable prototype and constructor
            key !== PROTOTYPE &&
            key !== STATIC &&
            key !== SUPER &&
            key !== WITH &&
            (allowInit || key !== INIT);
  }

  // verifies a generic value is actually an object
  function isObject(value) {
    /*jshint eqnull: true */
    return value != null && typeof value === 'object';
  }

  // verifies the entire string is upper case
  // and contains eventually an underscore
  // used to avoid RegExp for non RegExp aware environment
  function isPublicStatic(key) {
    for(var c, i = 0; i < key.length; i++) {
      c = key.charCodeAt(i);
      if ((c < 65 || 90 < c) && c !== 95) {
        return false;
      }
    }
    return true;
  }

  // will eventually convert classes or constructors
  // into trait objects, before assigning them as such
  function transformMixin(trait) {
    if (isObject(trait)) return trait;
    else {
      var i, key, keys, object, proto;
      if (trait.isClass) {
        if (trait.length) {
          warn((trait.name || 'Class') + ' should not expect arguments');
        }
        for (
          object = {init: trait},
          proto = trait.prototype;
          proto && proto !== Object.prototype;
          proto = gPO(proto)
        ) {
          for (i = 0, keys = oK(proto); i < keys.length; i++) {
            key = keys[i];
            if (isNotASpecialKey(key, false) && !hOP.call(object, key)) {
              defineProperty(object, key, gOPD(proto, key));
            }
          }
        }
      } else {
        for (
          i = 0,
          object = {},
          proto = trait({}),
          keys = oK(proto);
          i < keys.length; i++
        ) {
          key = keys[i];
          if (key !== INIT) {
            // if this key is the mixin one
            if (~key.toString().indexOf('mixin:init') && isArray(proto[key])) {
              // set the init simply as own method
              object.init = proto[key][0];
            } else {
              // simply assign the descriptor
              defineProperty(object, key, gOPD(proto, key));
            }
          }
        }
      }
      return object;
    }
  }

  // set a property via defineProperty using a common descriptor
  // only if properties where not defined yet.
  // If publicStatic is true, properties are both non configurable and non writable
  function setProperty(inherits, target, key, descriptor, publicStatic, isNOTExtendingNative) {
    var
      hasValue = hOP.call(descriptor, VALUE),
      configurable,
      value
    ;
    if (publicStatic) {
      if (hOP.call(target, key)) {
        // in case the value is not a static one
        if (
          inherits &&
          isObject(target[key]) &&
          isObject(inherits[CONSTRUCTOR][key])
        ) {
          copyMerged(inherits[CONSTRUCTOR][key], target[key]);
        }
        return;
      } else if (hasValue) {
        // in case it's an object perform a deep copy
        copyValueIfObject(descriptor, copyDeep);
      }
    } else if (hasValue) {
      value = descriptor[VALUE];
      if (typeof value === 'function' && trustSuper(value)) {
        descriptor[VALUE] = wrap(inherits, key, value, publicStatic);
      }
    } else if (isNOTExtendingNative) {
      wrapGetOrSet(inherits, key, descriptor, 'get');
      wrapGetOrSet(inherits, key, descriptor, 'set');
    }
    configurable = isConfigurable(key, publicStatic);
    descriptor.enumerable = false; // was: publicStatic;
    descriptor.configurable = configurable;
    if (hasValue) {
      descriptor.writable = configurable;
    }
    defineProperty(target, key, descriptor);
  }

  // basic check against expected properties or methods
  // used when `implements` is used
  function verifyImplementations(interfaces, target) {
    for (var
      current,
      key,
      i = 0; i < interfaces.length; i++
    ) {
      current = interfaces[i];
      for (key in current) {
        if (hOP.call(current, key) && !hOP.call(target, key)) {
          warn(key.toString() + ' is not implemented');
        }
      }
    }
  }

  // warn if something doesn't look right
  // such overwritten public statics
  // or traits / mixins assigning twice same thing
  function warn(message) {
    try {
      console.warn(message);
    } catch(meh) {
      /*\_(ツ)_*/
    }
  }

  // lightweight wrapper for methods that requires
  // .super(...) invokaction - inspired by old klass.js
  function wrap(inherits, key, method, publicStatic) {
    return function () {
      if (!hOP.call(this, SUPER)) {
        // define it once in order to use
        // fast assignment every other time
        define(this, SUPER, null, publicStatic);
      }
      var
        previous = this[SUPER],
        current = (this[SUPER] = inherits[key]),
        result = method.apply(this, arguments)
      ;
      this[SUPER] = previous;
      return result;
    };
  }

  // get/set shortcut for the eventual wrapper
  function wrapGetOrSet(inherits, key, descriptor, gs, publicStatic) {
    if (hOP.call(descriptor, gs) && trustSuper(descriptor[gs])) {
      descriptor[gs] = wrap(
        gOPD(inherits, key),
        gs,
        descriptor[gs],
        publicStatic
      );
    }
  }

  // the actual Class({ ... }) definition
  return function (description) {
    var
      hasConstructor = hOP.call(description, CONSTRUCTOR),
      hasParent = hOP.call(description, EXTENDS),
      parent = hasParent && description[EXTENDS],
      hasParentPrototype = hasParent && typeof parent === 'function',
      inherits = hasParentPrototype ? parent[PROTOTYPE] : parent,
      constructor = hasConstructor ?
        description[CONSTRUCTOR] :
        createConstructor(hasParentPrototype, parent),
      hasSuper = hasParent && hasConstructor && trustSuper(constructor),
      prototype = hasParent ? create(inherits) : constructor[PROTOTYPE],
      // do not wrap getters and setters in GJS extends
      isNOTExtendingNative = toString.call(inherits).indexOf(' GObject_') < 0,
      mixins,
      length
    ;
    if (hasSuper && isNOTExtendingNative) {
      constructor = wrap(inherits, CONSTRUCTOR, constructor, false);
    }
    // add modules/mixins (that might swap the constructor)
    if (hOP.call(description, WITH)) {
      mixins = addMixins([].concat(description[WITH]), prototype, inherits, isNOTExtendingNative);
      length = mixins.length;
      if (length) {
        constructor = (function (parent) {
          return function () {
            var i = 0;
            while (i < length) mixins[i++].call(this);
            return parent.apply(this, arguments);
          };
        }(constructor));
        constructor[PROTOTYPE] = prototype;
      }
    }
    if (hOP.call(description, STATIC)) {
      // add new public static properties first
      copyOwn(description[STATIC], constructor, inherits, true, true, isNOTExtendingNative);
    }
    if (hasParent) {
      // in case it's a function
      if (parent !== inherits) {
        // copy possibly inherited statics too
        copyOwn(parent, constructor, inherits, true, true, isNOTExtendingNative);
      }
      constructor[PROTOTYPE] = prototype;
    }
    if (prototype[CONSTRUCTOR] !== constructor) {
      define(prototype, CONSTRUCTOR, constructor, false);
    }
    // enrich the prototype
    copyOwn(description, prototype, inherits, false, true, isNOTExtendingNative);
    if (hOP.call(description, IMPLEMENTS)) {
      verifyImplementations([].concat(description[IMPLEMENTS]), prototype);
    }
    if (hasParent && !getPrototypeOf) {
      define(prototype, PROTO, inherits, false);
    }
    return defineProperty(constructor, 'isClass', isClassDescriptor);
  };

}(Object));
module.exports = Class;
},{}],7:[function(require,module,exports){
/*!
Copyright (C) 2015 by WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
var $ = (function (O, A) {'use strict';
  function $(CSS, parentNode) {
    return typeof CSS === 'string' ?
      search(CSS.split(splitter), parentNode || document) :
      (CSS instanceof QueryResult ?
        CSS : wrap.apply(null, A.concat(CSS)));
  }
  function QueryResult() {
    dP(this, 'length', lengthDescriptor);
  }
  function protoValue(value) {
    return {
      configurable: true,
      writable: true,
      value: value
    };
  }
  function search(list, el) {
    for (var
      j, l, tmp,
      query = el.query || el.querySelector,
      queryAll = el.queryAll || el.querySelectorAll,
      current,
      nodes, one,
      result = new QueryResult(),
      t = 0, i = 0,
      length = list.length;
      i < length; i++
    ) {
      current = list[i];
      one = current.slice(-6) === ':first';
      if (one) {
        tmp = query.call(el, current.slice(0, -6));
        if (tmp) result[t++] = tmp;
      } else {
        nodes = queryAll.call(el, current);
        j = 0;
        l = nodes.length;
        while (j < l) result[t++] = nodes[j++];
      }
    }
    result.length = t;
    return result;
  }
  function wrap() {
    var result = new QueryResult();
    A.push.apply(result, arguments);
    return result;
  }
  var
    dP = O.defineProperty,
    lengthDescriptor = protoValue(0),
    splitter = /\s*,\s*/,
    QRProto = (O.setPrototypeOf || function (o, p) {
      return dP(
        // should pass broken partial polyfills too
        O.create(p),
        'constructor',
        protoValue(o.constructor)
      );
    })(QueryResult.prototype, A)
  ;
  [
    'concat',
    'copyWithin',
    'filter',
    'map',
    'reverse',
    'slice',
    'sort',
    'splice'
  ].forEach(function (name) {
    var method = A[name];
    if (method) {
      dP(QRProto, name, protoValue(function () {
        return wrap.apply(null, method.apply(this, arguments));
      }));
    }
  });
  QueryResult.prototype = ($.prototype = QRProto);
  return dP($, 'extend', protoValue(function extend(name, value) {
      dP(QRProto, name, typeof value === 'function' ?
          protoValue(value) : value);
      return $;
    }))
    .extend('dispatch', function dispatch(type, eventInitDict) {
      var
        e = arguments.length < 2 ?
          new CustomEvent(type) :
          new CustomEvent(type, eventInitDict),
        i = 0,
        l = this.length
      ;
      while (i < l) this[i++].dispatchEvent(e);
      return this;
    })
    .extend('off', function off(type, handler, capture) {
      for (var c = !!capture, i = 0, l = this.length; i < l; i++) {
        this[i].removeEventListener(type, handler, c);
      }
      return this;
    })
    .extend('on', function on(type, handler, capture) {
      for (var c = !!capture, i = 0, l = this.length; i < l; i++) {
        this[i].addEventListener(type, handler, c);
      }
      return this;
    })
  ;
}(Object, Array.prototype));
},{}],8:[function(require,module,exports){
/*jslint forin: true, plusplus: true, indent: 2, browser: true, unparam: true */
/*!
Copyright (C) 2014-2015 by Andrea Giammarchi - @WebReflection

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

*/
module.exports = (function (O) {
  'use strict';

  var
    toString = O.toString,
    has = O.hasOwnProperty,
    camelFind = /([a-z])([A-Z])/g,
    ignoreSpecial = /^@(?:page|font-face)/,
    isMedia = /^@(?:media)/,
    isArray = Array.isArray || function (arr) {
      return toString.call(arr) === '[object Array]';
    },
    empty = [],
    restyle;

  function ReStyle(component, node, css, prefixes, doc) {
    this.component = component;
    this.node = node;
    this.css = css;
    this.prefixes = prefixes;
    this.doc = doc;
  }

  function replace(substitute) {
    if (!(substitute instanceof ReStyle)) {
      substitute = restyle(
        this.component, substitute, this.prefixes, this.doc
      );
    }
    this.remove();
    ReStyle.call(
      this,
      substitute.component,
      substitute.node,
      substitute.css,
      substitute.prefixes,
      substitute.doc
    );
  }

  ReStyle.prototype = {
    overwrite: replace,
    replace: replace,
    set: replace,
    remove: function () {
      var node = this.node,
        parentNode = node.parentNode;
      if (parentNode) {
        parentNode.removeChild(node);
      }
    },
    valueOf: function () {
      return this.css;
    }
  };

  function camelReplace(m, $1, $2) {
    return $1 + '-' + $2.toLowerCase();
  }

  function create(key, value, prefixes) {
    var
      css = [],
      pixels = typeof value === 'number' ? 'px' : '',
      k = key.replace(camelFind, camelReplace),
      i;
    for (i = 0; i < prefixes.length; i++) {
      css.push('-', prefixes[i], '-', k, ':', value, pixels, ';');
    }
    css.push(k, ':', value, pixels, ';');
    return css.join('');
  }

  function property(previous, key) {
    return previous.length ? previous + '-' + key : key;
  }

  function generate(css, previous, obj, prefixes) {
    var key, value, i;
    for (key in obj) {
      if (has.call(obj, key)) {
        if (typeof obj[key] === 'object') {
          if (isArray(obj[key])) {
            value = obj[key];
            for (i = 0; i < value.length; i++) {
              css.push(
                create(property(previous, key), value[i], prefixes)
              );
            }
          } else {
            generate(
              css,
              property(previous, key),
              obj[key],
              prefixes
            );
          }
        } else {
          css.push(
            create(property(previous, key), obj[key], prefixes)
          );
        }
      }
    }
    return css.join('');
  }

  function parse(component, obj, prefixes) {
    var
      css = [],
      at, cmp, special, k, v,
      same, key, value, i, j;
    for (key in obj) {
      if (has.call(obj, key)) {
        j = key.length;
        if (!j) key = component.slice(0, -1);
        at = key.charAt(0) === '@';
        same = at || !component.indexOf(key + ' ');
        cmp = at && isMedia.test(key) ? component : '';
        special = at && !ignoreSpecial.test(key);
        k = special ? key.slice(1) : key;
        value = empty.concat(obj[j ? key : '']);
        for (i = 0; i < value.length; i++) {
          v = value[i];
          if (special) {
            j = prefixes.length;
            while (j--) {
              css.push('@-', prefixes[j], '-', k, '{',
                parse(cmp, v, [prefixes[j]]),
                '}');
            }
            css.push(key, '{', parse(cmp, v, prefixes), '}');
          } else {
            css.push(
              same ? key : component + key,
              '{', generate([], '', v, prefixes), '}'
            );
          }
        }
      }
    }
    return css.join('');
  }

  // hack to avoid JSLint shenanigans
  if ({undefined: true}[typeof document]) {
    // in node, by default, no prefixes are used
    restyle = function (component, obj, prefixes) {
      if (typeof component === 'object') {
        prefixes = obj;
        obj = component;
        component = '';
      } else {
        component += ' ';
      }
      return parse(component, obj, prefixes || empty);
    };
    // useful for different style of require
    restyle.restyle = restyle;
  } else {
    restyle = function (component, obj, prefixes, doc) {
      if (typeof component === 'object') {
        doc = prefixes;
        prefixes = obj;
        obj = component;
        c = (component = '');
      } else {
        c = component + ' ';
      }
      var c, d = doc || (doc = document),
        css = parse(c, obj, prefixes || (prefixes = restyle.prefixes)),
        head = d.head ||
          d.getElementsByTagName('head')[0] ||
          d.documentElement,
        node = head.insertBefore(
          d.createElement('style'),
          head.lastChild
        );
      node.type = 'text/css';
      // it should have been
      // if ('styleSheet' in node) {}
      // but JSLint bothers in that way
      if (node.styleSheet) {
        node.styleSheet.cssText = css;
      } else {
        node.appendChild(d.createTextNode(css));
      }
      return new ReStyle(component, node, css, prefixes, doc);
    };
  }

  // bringing animation utility in window-aware world only
  if (!{undefined: true}[typeof window]) {
    restyle.animate = (function (g) {

      var
        rAF = window.requestAnimationFrame ||
              window.webkitRequestAnimationFrame ||
              window.mozRequestAnimationFrame ||
              window.msRequestAnimationFrame ||
              function (fn) { setTimeout(fn, 10); },
        liveStyles = {},
        uid = 'restyle-'.concat(Math.random() * (+new Date()), '-'),
        uidIndex = 0,
        animationType,
        transitionType
      ;

      switch (true) {
        case !!g.AnimationEvent:
          animationType = 'animationend';
          break;
        case !!g.WebKitAnimationEvent:
          animationType = 'webkitAnimationEnd';
          break;
        case !!g.MSAnimationEvent:
          animationType = 'MSAnimationEnd';
          break;
        case !!g.OAnimationEvent:
          animationType = 'oanimationend';
          break;
      }

      switch (true) {
        case !!g.TransitionEvent:
          transitionType = 'transitionend';
          break;
        case !!g.WebKitTransitionEvent:
          transitionType = 'webkitTransitionEnd';
          break;
        case !!g.MSTransitionEvent:
          transitionType = 'MSTransitionEnd';
          break;
        case !!g.OTransitionEvent:
          transitionType = 'oTransitionEnd';
          break;
      }

      restyle.transition = function (el, info, callback) {
        var
          transition = info.transition || 'all .3s ease-out',
          id = el.getAttribute('id'),
          to = [].concat(info.to),
          from = update({}, info.from),
          noID = !id,
          style = {},
          currentID,
          result,
          live,
          t
        ;
        function drop() {
          if (transitionType) {
            el.removeEventListener(transitionType, onTransitionEnd, false);
          } else {
            clearTimeout(t);
            t = 0;
          }
        }
        function next() {
          style[currentID] = (live.last = update(from, to.shift()));
          live.css.replace(style);
          if (transitionType) {
            el.addEventListener(transitionType, onTransitionEnd, false);
          } else {
            t = setTimeout(onTransitionEnd, 10);
          }
        }
        function onTransitionEnd(e) {
          drop();
          if (to.length) {
            rAF(next);
          } else {
            if (!e) e = new CustomEvent('transitionend', {detail: result});
            else e.detail = result;
            if (callback) callback.call(el, e);
          }
        }
        function update(target, source) {
          for (var k in source) target[k] = source[k];
          return target;
        }
        if (noID) el.setAttribute('id', id = (uid + uidIndex++).replace('.','-'));
        currentID = '#' + id;
        if (liveStyles.hasOwnProperty(id)) {
          live = liveStyles[id];
          from = (live.last = update(live.last, from));
          style[currentID] = from;
          live.transition.remove();
          live.css.replace(style);
        } else {
          live = liveStyles[id] = {
            last: (style[currentID] = from),
            css: restyle(style)
          };
        }
        rAF(function() {
          style[currentID] = {transition: transition};
          live.transition = restyle(style);
          rAF(next);
        });
        return (result = {
          clean: function () {
            if (noID) el.removeAttribute('id');
            drop();
            live.transition.remove();
            live.css.remove();
            delete liveStyles[id];
          },
          drop: drop
        });
      };

      ReStyle.prototype.getAnimationDuration = function (el, name) {
        for (var
          chunk, duration,
          classes = el.className.split(/\s+/),
          i = classes.length; i--;
        ) {
          chunk = classes[i];
          if (
            chunk.length &&
            (new RegExp('\\.' + chunk + '(?:|\\{|\\,)([^}]+?)\\}')).test(this.css)
          ) {
            chunk = RegExp.$1;
            if (
              (new RegExp(
                'animation-name:' +
                name +
                ';.*?animation-duration:([^;]+?);'
              )).test(chunk) ||
              (new RegExp(
                'animation:\\s*' + name + '\\s+([^\\s]+?);'
              )).test(chunk)
            ) {
              chunk = RegExp.$1;
              duration = parseFloat(chunk);
              if (duration) {
                return duration * (/[^m]s$/.test(chunk) ? 1000 : 1);
              }
            }
          }
        }
        return -1;
      };

      ReStyle.prototype.getTransitionDuration = function (el) {
        var
          cs = getComputedStyle(el),
          duration = cs.getPropertyValue('transition-duration') ||
                     /\s(\d+(?:ms|s))/.test(
                       cs.getPropertyValue('transition')
                     ) && RegExp.$1
        ;
        return parseFloat(duration) * (/[^m]s$/.test(duration) ? 1000 : 1);
      };

      ReStyle.prototype.transit = transitionType ?
        function (el, callback) {
          function onTransitionEnd(e) {
            drop();
            callback.call(el, e);
          }
          function drop() {
            el.removeEventListener(transitionType, onTransitionEnd, false);
          }
          el.addEventListener(transitionType, onTransitionEnd, false);
          return {drop: drop};
        } :
        function (el, callback) {
          var i = setTimeout(callback, this.getTransitionDuration(el));
          return {drop: function () {
            clearTimeout(i);
          }};
        }
      ;

      ReStyle.prototype.animate = animationType ?
        function animate(el, name, callback) {
          function onAnimationEnd(e) {
            if (e.animationName === name) {
              drop();
              callback.call(el, e);
            }
          }
          function drop() {
            el.removeEventListener(animationType, onAnimationEnd, false);
          }
          el.addEventListener(animationType, onAnimationEnd, false);
          return {drop: drop};
        } :
        function animate(el, name, callback) {
          var i, drop, duration = this.getAnimationDuration(el, name);
          if (duration < 0) {
            drop = O;
          } else {
            i = setTimeout(
              function () {
                callback.call(el, {
                  type: 'animationend',
                  animationName: name,
                  currentTarget: el,
                  target: el,
                  stopImmediatePropagation: O,
                  stopPropagation: O,
                  preventDefault: O
                });
              },
              duration
            );
            drop = function () {
              clearTimeout(i);
            };
          }
          return {drop: drop};
        }
      ;
    }(window));
  }

  restyle.customElement = function (name, constructor, proto) {
    var
      key,
      ext = 'extends',
      prototype = Object.create(constructor.prototype),
      descriptor = {prototype: prototype},
      has = descriptor.hasOwnProperty,
      isExtending = proto && has.call(proto, ext)
    ;
    if (isExtending) {
      descriptor[ext] = proto[ext];
    }
    for (key in proto) {
      if (key !== ext) {
        prototype[key] = (
          key === 'css' ?
            restyle(
              isExtending ?
               (proto[ext] + '[is=' + name + ']') :
               name,
              proto[key]
            ) :
            proto[key]
        );
      }
    }
    return document.registerElement(name, descriptor);
  };

  restyle.prefixes = [
    'webkit',
    'moz',
    'ms',
    'o'
  ];

  return restyle;

/**
 * not sure if TODO since this might be prependend regardless the parser
 *  @namespace url(http://www.w3.org/1999/xhtml);
 *  @charset "UTF-8";
 */

}({}));
},{}],9:[function(require,module,exports){
require('dom4/build/dom4.max');
require('document-register-element/build/document-register-element.max');
require('document-register-element/build/innerHTML.max');

window.$ = require('query-result/build/query-result.max');
window.Class = require('es-class/build/es-class.npm');
window.restyle = require('restyle/build/restyle.node');
window.DOMClass = require('dom-class/build/dom-class.max');

require('dom-class/build/dom-class-mixins');

},{"document-register-element/build/document-register-element.max":1,"document-register-element/build/innerHTML.max":2,"dom-class/build/dom-class-mixins":3,"dom-class/build/dom-class.max":4,"dom4/build/dom4.max":5,"es-class/build/es-class.npm":6,"query-result/build/query-result.max":7,"restyle/build/restyle.node":8}]},{},[9]);
