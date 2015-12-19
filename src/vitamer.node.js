require('dom4');
require('document-register-element');
require('document-register-element/build/innerHTML');

var Vitamer = {
  $: require('query-result'),
  Class: require('es-class'),
  restyle: require('restyle'),
  DOMClass: require('dom-class')
};

require('dom-class/build/dom-class-mixins.node')( Vitamer.DOMClass );

module.exports = Vitamer;
