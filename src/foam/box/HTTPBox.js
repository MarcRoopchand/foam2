/**
 * @license
 * Copyright 2017 The FOAM Authors. All Rights Reserved.
 * http://www.apache.org/licenses/LICENSE-2.0
 */
foam.CLASS({
  package: 'foam.box',
  name: 'HTTPBox',

  implements: [ 'foam.box.Box' ],

  requires: [
    'foam.json.Outputter',
    'foam.json.Parser',
    'foam.box.HTTPReplyBox',
    'foam.net.web.HTTPRequest'
  ],

  imports: [
    'creationContext',
    {
      name: 'me',
      key: 'me',
      javaType: 'foam.box.Box'
    },
    'window'
  ],

  properties: [
    {
      class: 'String',
      name: 'url'
    },
    {
      class: 'String',
      name: 'method',
      value: 'POST'
    },
    {
      class: 'FObjectProperty',
      of: 'foam.json.Parser',
      name: 'parser',
      generateJava: false,
      factory: function() {
        return this.Parser.create({
          strict:          true,
          // Trust our own server, but force other servers to go through
          // whitelist.
          creationContext: this.url.indexOf(':') == -1 ?
            this.__context__     :
            this.creationContext
        });
      }
    },
    {
      class: 'FObjectProperty',
      of: 'foam.json.Outputter',
      name: 'outputter',
      generateJava: false,
      factory: function() {
        return this.Outputter.create().copyFrom(foam.json.Network);
      }
    }
  ],

  axioms: [
    {
      name: 'javaExtras',
      buildJavaClass: function(cls) {
        cls.extras.push(foam.java.Code.create({
          data: `
protected class Outputter extends foam.lib.json.Outputter {
  public Outputter() {
    super(foam.lib.json.OutputterMode.NETWORK);
  }

  protected void outputFObject(foam.core.FObject o) {
    if ( o == getMe() ) {
      o = getX().create(foam.box.HTTPReplyBox.class);
    }
    super.outputFObject(o);
  }
}

protected class ResponseThread implements Runnable {
  protected java.net.URLConnection conn_;
  public ResponseThread(java.net.URLConnection conn) {
    conn_ = conn;
  }

  public void run() {
  }
}
`}));
      }
    }
  ],

  methods: [
    function prepareURL(url) {
      /* Add window's origin if url is not complete. */
      if ( this.window && url.indexOf(':') == -1 ) {
        return this.window.location.origin + '/' + url;
      }

      return url;
    },

    {
      name: 'send',
      code: function send(msg) {
        // TODO: We should probably clone here, but often the message
        // contains RPC arguments that don't clone properly.  So
        // instead we will mutate replyBox and put it back after.
        var replyBox = msg.attributes.replyBox;

        msg.attributes.replyBox = this.HTTPReplyBox.create();

        var payload = this.outputter.stringify(msg);

        msg.attributes.replyBox = replyBox;

        var req = this.HTTPRequest.create({
          url:     this.prepareURL(this.url),
          method:  this.method,
          payload: payload
        }).send();

        req.then(function(resp) {
          return resp.payload;
        }).then(function(p) {
          var rmsg = this.parser.parseString(p);
          rmsg && replyBox && replyBox.send(rmsg);
        }.bind(this));
      },
      javaCode: `
// TODO: Go async and make request in a separate thread.
java.net.HttpURLConnection conn;
foam.box.Box replyBox = (foam.box.Box)message.getAttributes().get("replyBox");

try {
  java.net.URL url = new java.net.URL(getUrl());
  conn = (java.net.HttpURLConnection)url.openConnection();
  conn.setDoOutput(true);
  conn.setRequestMethod("POST");
  conn.setRequestProperty("Accept", "application/json");
  conn.setRequestProperty("Content-Type", "application/json");

  java.io.OutputStreamWriter output = new java.io.OutputStreamWriter(conn.getOutputStream(),
                                                                     java.nio.charset.StandardCharsets.UTF_8);


  // TODO: Clone message or something when it clones safely.
  message.getAttributes().put("replyBox", getX().create(foam.box.HTTPReplyBox.class));


  foam.lib.json.Outputter outputter = new foam.lib.json.Outputter(foam.lib.json.OutputterMode.NETWORK);
  outputter.setX(getX());
  output.write(outputter.stringify(message));

  message.getAttributes().put("replyBox", replyBox);

  output.close();

// TODO: Switch to ReaderPStream when https://github.com/foam-framework/foam2/issues/745 is fixed.
byte[] buf = new byte[8388608];
java.io.InputStream input = conn.getInputStream();

int off = 0;
int len = buf.length;
int read = -1;
while ( len != 0 && ( read = input.read(buf, off, len) ) != -1 ) {
  off += read;
  len -= read;
}

if ( len == 0 && read != -1 ) {
  throw new RuntimeException("Message too large.");
}

String str = new String(buf, 0, off, java.nio.charset.StandardCharsets.UTF_8);

foam.core.FObject responseMessage = getX().create(foam.lib.json.JSONParser.class).parseString(str);

if ( responseMessage == null ) {
  throw new RuntimeException("Error parsing response.");
}

if ( ! ( responseMessage instanceof foam.box.Message ) ) {
  throw new RuntimeException("Invalid response type: " + responseMessage.getClass().getName() + " expected foam.box.Message.");
}


replyBox.send((foam.box.Message)responseMessage);

} catch(java.io.IOException e) {
  foam.box.Message replyMessage = getX().create(foam.box.Message.class);
  replyMessage.setObject(e);
  replyBox.send(replyMessage);
}
`
    }
  ]
});
