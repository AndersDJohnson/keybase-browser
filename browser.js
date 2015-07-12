

var kbpgpBrowser = {};

kbpgpBrowser.options = {
  // var keyBaseUrl = 'file:///C:/Users/anders/code/keybase-browser/stub';
  // keyBaseUrl: '/stub/keybase.io',
  var keyBaseUrl = 'https://keybase.io';
  // gitHubApiUrl: '/stub/api.github.com'
  var gitHubApiUrl = 'https://api.github.com';
};

kbpgpBrowser.makeGitHubCommentApiUrl = function (user, repo, id) {
  return kbpgpBrowser.options.gitHubApiUrl + 
  '/repos/' + user + '/' + repo + '/issues/comments/' + id;
};

kbpgpBrowser.getKeyForUser = function (username, cb) {
	$.get(kbpgpBrowser.options.keyBaseUrl + '/' + username + '/key.asc')
 .then(function (data) {
  if (cb) return cb(null, data);
})
 .fail(function (err) {
  if (cb) return cb(err);
});
};

kbpgpBrowser.makeKeyRingWithArmoredKey = function (pgp_key, cb) {
	kbpgp.KeyManager.import_from_armored_pgp({
    armored: pgp_key
  }, function(err, km) {
    if (err) return cb && cb(err);

    var ring = new kbpgp.keyring.KeyRing();
    kms = [km];
    for (var i in kms) {
      ring.add_key_manager(kms[i]);
    };
    if (cb) return cb(null, ring);
  })
};



kbpgpBrowser.runForComment = function (ghUser, ghRepo, id) {
  var commentUrl = kbpgpBrowser.makeGitHubCommentApiUrl(ghUser, ghRepo, id);
  console.log(commentUrl);

  $.getJSON(commentUrl)
  .then(function (data) {
    kbpgpBrowser.withComment(data);
  })
  .fail(function (err) {
    throw err;
  });
};

kbpgpBrowser.withComment = function (data) {
  console.log(data);
  console.log(data.body);

  var body = data.body;

  var msg = body.split(/\n-+BEGIN PGP SIGNATURE-+/)[0];
  msg = msg.trim();
  console.log('"' + msg + '"');

  var userMatch = body.match(/^\s*Keybase-?User(?:name)?\s*:\s*([^\s]+)\s*$/im);
  if (! userMatch) {
    throw new Error("Could not find Keybase-Username in PGP signature armor headers.")
  }
  var username = userMatch[1];

  kbpgpBrowser.getKeyForUser(username, function (err, key) {
    kbpgpBrowser.withKeyForUser(err, {
      key: key,
      msg: msg,
      armored: body
    });
  });
};

kbpgpBrowser.withKeyForUser = function (err, params) {
  if (err) throw err;
  var key = params.key;
  var msg = params.msg;
  var armored = params.armored;
  armored = armored.substr(armored.indexOf('-----BEGIN PGP'));
  console.log('msg: "' + msg + '"');
  console.log('arm: "' + armored + '"');
  kbpgpBrowser.makeKeyRingWithArmoredKey(key, function (err, ring) {
    params.ring = ring;
    kbpgpBrowser.withRing(err, params);
  });
};

kbpgpBrowser.withRing = function (err, params) {
  if (err) throw err;

  var ring = params.ring;
  var msg = params.msg;
  var armored = params.armored;
  var msg = params.msg;
  var data = new kbpgp.Buffer(msg);

  kbpgp.unbox({
    keyfetch: ring,
    armored: armored,
    data: data
  }, function(err, literals) {
    if (err != null) {
      return console.log("Problem: " + err);
    } else {
      console.log("decrypted message");
      console.log(literals[0].toString());
      console.log(arguments);
      var ds = km = null;
      ds = literals[0].get_data_signer();
      if (ds) { km = ds.get_key_manager(); }
      if (km) {
        console.log("Signed by PGP fingerprint");
        console.log(km.get_pgp_fingerprint().toString('hex'));
      }
    }
  });
};

(function () {
  var id = $('[id^="issuecomment-"]').attr('id').split('-')[1];
  console.log('id', id);
  var ghUser = 'AndersDJohnson';
  var ghRepo = 'magnificent.js';

  kbpgpBrowser.runForComment(ghUser, ghRepo, id)
})();
