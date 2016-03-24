/*
 * @license
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// TODO: comment
(function() {

  var lookup_ = function lookup_(id) {
    var a = foam.core[id];
    if ( a ) return a;
    var path = id.split('.');
    var root = global;
    for ( var i = 0 ; root && i < path.length ; i++ )
      root = root[path[i]];
    return root;
  };

  var cache = {};

  var X = {
    lookup: function(id) {
      return id && ( cache[id] || ( cache[id] = lookup_(id) ) );
    },

    register: function(cls) {
      cache[cls.id] = cls;
      if ( cls.package === 'foam.core' )
        cache[cls.name] = cls;
      var path = cls.id.split('.');
      var root = global;
      for ( var i = 0 ; i < path.length-1 ; i++ ) {
        root = root[path[i]] || ( root[path[i]] = {} );
      }
      root[path[path.length-1]] = cls;
    },

    sub: function sub(opt_args, opt_name) {
      var sub = Object.create(this);

      for ( var key in opt_args ) {
        if ( opt_args.hasOwnProperty(key) ) {
          var v = opt_args[key];

          if ( foam.core.Slot.isInstance(v) ) {
            sub[key + '$'] = v;
            // For performance, these could be reused.
            Object.defineProperty(sub, key, {
              get: function() { return v.get(); },
              configurable: true,
              enumerable: false
            });
          } else {
            sub[key + '$'] = foam.core.ConstantSlot.create({value: v});
            sub[key] = v;
          }
        }
      }

      if ( opt_name )
        Object.defineProperty(sub, 'NAME', {value: opt_name, enumerable: false});

      return sub;
    }
  };

  foam.X = X;

  // TODO: comment
  for ( var key in X ) foam[key] = X[key].bind(X);
})();
