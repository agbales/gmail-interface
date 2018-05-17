var CLIENT_ID = config.CLIENT_ID;
var API_KEY = config.API_KEY;
var DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest"];
var SCOPES = 'https://www.googleapis.com/auth/gmail.readonly ' +
             'https://www.googleapis.com/auth/gmail.send';

var authorizeButton = document.getElementById('authorize-button');
var signoutButton = document.getElementById('signout-button');

/* On load, called to load the auth2 library and API client library. */
function handleClientLoad() {
  gapi.load('client:auth2', initClient);
}

/* Initializes API client library & sets up sign-in state listeners. */
function initClient() {
  gapi.client.init({
    discoveryDocs: DISCOVERY_DOCS,
    clientId: CLIENT_ID,
    scope: SCOPES
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  });
}

/* Called when signed in status changes, updates UI */
function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';
    displayInbox();
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';
  }
}

/* Sign in */
function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

/* Sign out */
function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
}

/* INBOX */
function displayInbox() {
  var request = gapi.client.gmail.users.messages.list({
    'userId': 'me',
    'labelIds': 'INBOX',
    'maxResults': 30
  });

  request.execute(function(response) {
    $.each(response.messages, function() {
      var messageRequest = gapi.client.gmail.users.messages.get({
        'userId': 'me',
        'id': this.id
      });

      messageRequest.execute(appendMessageRow);
    });
  });
}

function appendMessageRow(message) {
  $('.table-inbox tbody').append(
    '<tr id="' + message.id + '">\
      <td>'+getHeader(message.payload.headers, 'From').replace(/"/g, '')+'</td>\
      <td>'+getHeader(message.payload.headers, 'Subject')+'</td>\
      <td>'+getHeader(message.payload.headers, 'Date').substring(0,11)+'</td>\
    </tr>'
  );
}

function getHeader(headers, index) {
  var header = '';
  $.each(headers, function(){
    if(this.name === index){
      header = this.value;
    }
  });
  return header;
}

function getBody(message) {
  var encodedBody = '';
  if(typeof message.parts === 'undefined') {
    encodedBody = message.body.data;
  } else {
    // encodedBody = getHTMLPart(message.parts);
    encodedBody = getPlainTextPart(message.parts);
  }
  encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return decodeURIComponent(escape(window.atob(encodedBody)));
}

function getPlainTextPart(arr) {
  for(var x = 0; x <= arr.length; x++) {
    if(typeof arr[x].parts === 'undefined') {
      if(arr[x].mimeType === 'text/plain') {
        return arr[x].body.data;
      }
    } else {
      return getHTMLPart(arr[x].parts);
    }
  }
  return '';
}

function getHTMLPart(arr) {
  for(var x = 0; x <= arr.length; x++) {
    if(typeof arr[x].parts === 'undefined') {
      if(arr[x].mimeType === 'text/html') {
        return arr[x].body.data;
      }
    } else {
      return getHTMLPart(arr[x].parts);
    }
  }
  return '';
}

/* get message, open & close */
$("#inbox").on("click", "tr", function(){
  var messageId = $(this).attr("id")
  var request = gapi.client.gmail.users.messages.get({
    'userId': 'me',
    'id': messageId,
    'format': "full"
  });
  request.execute(openMessage);

  // testing thread--
  request.execute(getThread);
  //---//
});


// ---- test THREAD -- this section and request in function above
function getThread(th) {
  var threadId = th.threadId;
  var request = gapi.client.gmail.users.threads.get({
    'userId': 'me',
    'id': threadId
  });
  request.execute(logit);
}
function logit(thingy) {
  var thread = thingy;
  for (var i=0; i<= thread.messages.length; i++) {
    console.log(i + "-->", getBody(thread.messages[i].payload));
  }
}
//------//



function openMessage(message) {
  var reply_to = (getHeader(message.payload.headers, 'Reply-to') !== '' ?
    getHeader(message.payload.headers, 'Reply-to') :
    getHeader(message.payload.headers, 'From')).replace(/\"/g, '&quot;');
  var reply_subject = 'Re: '+ getHeader(message.payload.headers, 'Subject').replace(/\"/g, '&quot;');
  var messageId = getHeader(message.payload.headers, 'Message-ID');

  fillInReply(reply_to, reply_subject, messageId);

  $("#message-from").text(getHeader(message.payload.headers, 'Reply-to'));
  $("#message-subject").text(getHeader(message.payload.headers, 'Subject'));
  $("#message-text").html(getBody(message.payload));
  $("#message-overlay").css("height", "100%");
}

function closeMessage() {
  $("#message-overlay").css("height", "0%");
}

/* sending messages */
function sendEmail() {
  $('#send-button').addClass('disabled');
  sendMessage({
      'To': $('#compose-to').val(),
      'Subject': $('#compose-subject').val()
    },
    $('#compose-message').val(),
    composeTidy
  );
  return false;
}

function composeTidy() {
  closeMessage();
  $('#compose-to').val('');
  $('#compose-subject').val('');
  $('#compose-message').val('');
  $('#alert').text("message sent");
}

/* send new message */
function sendMessage(headers_obj, message, callback) {
  var email = '';
  for(var header in headers_obj) {
    email += header += ": "+headers_obj[header]+"\r\n";
    email += "\r\n" + message;
  }
  var sendRequest = gapi.client.gmail.users.messages.send({
    'userId': 'me',
    'resource': {
      'raw': window.btoa(email).replace(/\+/g, '-').replace(/\//g, '_')
    }
  });
  return sendRequest.execute(callback);
}

/* reply to thread*/
function sendReply() {
  $('#reply-button').addClass('disabled');
  sendMessage({
      'To': $('#reply-to').val(),
      'Subject': $('#reply-subject').val(),
      'In-Reply-To': $('#reply-message-id').val()
    },
    $('#reply-message').val(),
    replyTidy
  );
  return false;
}

function replyTidy() {
  closeMessage();
  $('#alert').text("reply sent");
  $('#reply-message').val('');
  $('#reply-button').removeClass('disabled');
}

function fillInReply(to, subject, message_id) {
  $('#reply-to').val(to);
  $('#reply-subject').val(subject);
  $('#reply-message-id').val(message_id);
}
