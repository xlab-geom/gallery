/*global
  Uint32Array
  ,Uint8Array
*/

var flipbook = {};

//--------------------------------------------------------
// file
//--------------------------------------------------------

/*
flipbook.load_image = function(url, callback) {
  'use strict';
  var image = new Image();
  image.onload = function() { callback(image); };
  image.src = url;
};

flipbook.load_images_separately = function(urls, callback) {
  'use strict';

  var image = [];
  var counter = 0;

  function make_callback(i) {
    return function(img) {
      image[i] = img;
      counter += 1;
      if (counter === urls.length) {
	callback(image);
      }
    };
  }

  for (var i = 0; i !== urls.length; ++i) {
    flipbook.load_image(urls[i], make_callback(i));
  }
};

flipbook.pad = function(n, width, z) {
  'use strict';
  z = z || '0';
  n = n + '';
  return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
};

flipbook.make_urls = function(url, count) {
  'use strict';
  var urls = [];
  for (var i= 0; i !== count; ++i) {
    var url = 'ellipse/' + flipbook.pad(i, 3) + '.png';
    urls.push(url);
  }
  return urls;
};
*/
//------------------------------------------------------

flipbook.image_url = function(data) {
  'use strict';
  var blob = new Blob([ data ], {type : 'image/png'});
  var urlCreator = window.URL || window.webkitURL;
  return urlCreator.createObjectURL(blob);
};


flipbook.load_file = function(url, callback) {
  'use strict';
  var req = new XMLHttpRequest();
  req.open('GET', url);
  req.responseType = 'arraybuffer';

  /*jshint unused:false*/
  req.onload = function(e) {
    if (req.readyState === 4 && req.status === 200) {
      callback(req.response);
    }
  };
  /*jshint unused:true*/

  req.send(null);
};

flipbook._round_up = function(length, alignment) {
  'use strict';
  if (length % alignment === 0) { return length; }
  return length + (alignment - length % alignment);
};

flipbook.load_images = function(url, callback) {
  'use strict';

  var ALIGNMENT = 4;

  var images = [];
  var total = 0;

  function on_image(i, image) {
    images[i] = image;
    if (images.length === total) {
      callback(images);
    }
  }

  function make_image_callback(i, image) {
    return function() { on_image(i, image); };
  }

  function on_file(data) {
    var p = 0;
    var i = 0;

    while(p < data.byteLength) {
      var length = new Uint32Array( data.slice(p, p+4) )[0];
      p += 4;
      if (flipbook._round_up(p+length, ALIGNMENT) >= data.byteLength) {
	total = i+1;
      }
      var image = new Image();
      var slice = new Uint8Array(data.slice(p, p+length));
      url = flipbook.image_url( slice );

      image.onload = make_image_callback(i, image);
      image.src = url;
      p = flipbook._round_up(p+length, ALIGNMENT);
      ++i;
    }
  }

  flipbook.load_file(url, on_file);
};

//--------------------------------------------------------
// mouse
//--------------------------------------------------------

flipbook.MouseFilter = function() {
  'use strict';

  var client;

  // jshint unused:false

  function new_data() {
    return {
      type : null,
      time : 0,
      dtime : 0,
      buttons : [],
      button : 0,
      position : [ 0, 0 ],
      dposition : [ 0, 0 ]
    };
  }

  var data_stack = [ new_data(), new_data() ];
  function data() { return data_stack[1]; }

  function update(type, event, data) {
    // create a new event
    var time = Date.now();
    var d = {
      type : type,
      time : time,
      dtime : time - data.time,
      button : data.buttons[data.buttons.length - 1],
      buttons : data.buttons,
      position : [ event.clientX, event.clientY ],
      dposition : [
        event.clientX - data.position[0], event.clientY - data.position[1]
      ]
    };
    // push the new event into the stack
    data_stack = [ data_stack[1], d ];
  }

  function on_mouse_down(event) {
    // return if button is not one of [0, 1, 2]
    if (event.button < 0 || event.button > 2) {
      return;
    }
    // return if event.button is already in button stack
    if (data().buttons.indexOf(event.button) !== -1) {
      return;
    }
    // insert the button into the button stack
    data().buttons.push(event.button);
    // update and fire the mouse event
    update('down', event, data());
    if (client) {
      client.on_mouse_down(data());
    }
  }
  function on_mouse_move(event) {
    // return if no buttons are pressed
    if (data().buttons.length === 0) {
      return;
    }
    // update and fire the mouse event
    update('move', event, data());
    if (client) {
      client.on_mouse_move(data());
    }
  }
  function on_mouse_up(event) {
    // return if button is not one of [0, 1, 2]
    if (event.button < 0 || event.button > 2) {
      return;
    }
    // return if event.button is not in the button stack
    if (data().buttons.indexOf(event.button) === -1) {
      return;
    }
    // remove the button from the button stack
    // update and fire the mouse event
    update('up', event, data_stack[0]);
    if (client) {
      client.on_mouse_up(data());
    }
    data().buttons.pop();
  }
  function on_mouse_enter(event) { data_stack = [ new_data(), new_data() ]; }
  function on_mouse_exit(event) { data_stack = [ new_data(), new_data() ]; }

  function connect(element) {
    element.addEventListener('mousedown', on_mouse_down);
    element.addEventListener('mousemove', on_mouse_move);
    element.addEventListener('mouseup', on_mouse_up);
    element.addEventListener('mouseover', on_mouse_enter);
    element.addEventListener('mouseout', on_mouse_exit);
  }

  function disconnect(element) {
    element.removeEventListener('mousedown', on_mouse_down);
    element.removeEventListener('mousemove', on_mouse_move);
    element.removeEventListener('mouseup', on_mouse_up);
    element.removeEventListener('mouseover', on_mouse_enter);
    element.removeEventListener('mouseout', on_mouse_exit);
  }

  function add(client_) { client = client_; }
  function remove(client_) { client = null; }

  return {
    connect : connect,
    disconnect : disconnect,
    add : add,
    remove : remove
  };
};

flipbook.Animator = function(callback) {
  'use strict';

  var SPEED = 0.2;
  var DECAY = 1.0;

  var _time = 0;
  var _m = null;

  function start(m) {
    _time = Date.now();
    _m = m;
  }
  function stop() { _m = null; }

  function update() {
    if (_m === null) {
      return;
    }
    var time = Date.now();
    var dt = (time - _time) * SPEED;
    callback(_m * dt);
    // decay
    if (DECAY !== 1.0) {
      _m = _m * DECAY;
    }
    _time = time;
  }

  return {start : start, stop : stop, update : update};
};


flipbook.Mouse = function(animate) {
  'use strict';

  var SPEED = 0.05;
  var TIME_CUTOFF = 200;
  var INITIAL_SPEED = 2.0;
  // FIX
  var center = [ 0.0, 0.0, 0.0 ];
  var interpreter;
  var value = 0;
  var animator;

  /*jshint unused:false*/
  function on_mouse_down(event) {
    animator.stop(); }
  function on_mouse_move(event) {
    value += event.dposition[0];
  }
  function on_mouse_up(event) {
    if (event.dtime < TIME_CUTOFF) {
      animator.start(event.dposition[0]);
    }
  }

  function on_animator(v) {
    value += SPEED * v;
  }

  /*jshint unused:true*/

  function init() {
    animator = flipbook.Animator(on_animator);
    if (animate) {
      animator.start(INITIAL_SPEED);
    }
  }

  init();

  function get_value() {
    return Math.floor(value);
  }

  return {
    update : animator.update,
    get_value : get_value,
    slot: { on_mouse_down:on_mouse_down, on_mouse_up:on_mouse_up, on_mouse_move:on_mouse_move }
  };
};

flipbook.run = function(id, url) {
  'use strict';

  //var count = 300;
  //var size = [600, 300];

  var count;
  var size;
  var image;
  var canvas;
  var context;
  var mouse_filter;
  var mouse;

  var start_time;

  function on_images(image_) {
    console.log('load time=', (Date.now() - start_time)/1000);
    size = [image_[0].width, image_[0].height];
    //size = [600,300];
    count = image_.length;

    canvas = document.getElementById(id);
    canvas.width = size[0];
    canvas.height = size[1];
    //document.body.appendChild(canvas);
    canvas.style.backgroundColor = '#0000ff';
    context=canvas.getContext('2d');
    context.drawImage( image_[0], 0, 0, size[0], size[1]);

    mouse_filter = flipbook.MouseFilter();
    mouse_filter.connect(canvas);
    mouse = flipbook.Mouse(true);
    mouse_filter.add(mouse.slot);

    image = image_;
  }

  start_time = Date.now();
  /*
  // separate images
  var urls = flipbook.make_urls('ellipse', 300);
  console.log(urls);
  flipbook.load_images_separately(urls, on_images);
  */

  flipbook.load_images(url, on_images);

  function render() {
    if ( ! image ) { return; }
    mouse.update();
    var v = mouse.get_value() % count;
    if (v < 0) {
      v += count;
    }
    context.drawImage( image[v], 0, 0, size[0], size[1]);
  }

  // loop
  (function loop() {
    window.requestAnimationFrame(loop);
    render();
  })();
};
