$(function() { 
    var socketchat = new SocketChat();
    socketchat.init();
})

var SocketChat = function() {
    this.socket = null;
    this.lastTypingTime;
    this.FADE_TIME = 150; // ms
    this.TYPING_TIMER_LENGTH = 400; // ms
    this.FLAGS = {
        typing: false,
        connected: false,
        firstLogin: true,
        hideLog: false,
        comboKeyPressed: false
    };
    this.USER_CONFIG = {
        nickname: null,
        color: '#000'
    };
};

SocketChat.prototype = {
    init: function() {
        var that = this;
        // this.socket = io.connect();
        this.socket = io();
        this.socket.on('connect', function() {
            $('.info').text('Get yourself a nickname :)');
            $('.nickWrapper').show();
            $('.nicknameInput').focus();
            $('.messageInput').val('');
        });

        $('.loginWrapper').on('click', function() {
            $('.nicknameInput').focus();  
        });

        $('.sendBtn').on('click', function() {
            var $messageInput = $('.messageInput'),
                msg = $messageInput.val();            
            if (msg.trim().length > 0 && that.FLAGS.connected) {
                msg = msg.replace(/\s+$/g, '').replace(/\n/g, '<br/>').replace(/\s/g, '&nbsp;');
                $messageInput.val('');
                that.socket.emit('postMsg', { message: msg, color: that.USER_CONFIG.color }); // emit 'postMsg' event to server
                that._addChatMessage({nickname: 'me', message: msg, color: that.USER_CONFIG.color}, { isSelf: true});
            }
            $messageInput.focus();
        });

        $('.sendImg').on('change', function() {
            var $this = $(this);
            if (this.files.length != 0) {
                var file = this.files[0],
                     reg =  /^(image\/)(jpg|jpeg|gif|jpeg|png)$/i,
                     reader = new FileReader();
                if (!reg.test(file.type)) {
                    alert('pls select image.');
                    that._displayNewMsg('system', 'pls select image.', 'red');
                    $this.val('');
                    return;
                }

                if (!reader) {
                    that._displayNewMsg('system', 'your browser does\'t support fileReader.', 'red');
                    $this.val('');
                    return;
                };

                reader.onload = function(e) {
                    $this.val('');
                    that.socket.emit('postImg', { stream: e.target.result, color: that.USER_CONFIG.color });
                };
                reader.readAsDataURL(file);
            };            
        });

        this._initalEmoji();

        // get color
        $('.colorStyle').on('change', function () {
            that.USER_CONFIG.color = $(this).val();
        });

        $('.emoji').on('click', function(e) {
            $('.emojiWrapper').css({'display': 'block'});
            e.stopPropagation();
        });

        $('body').on('click', function(e) {
            var $emojiwrapper = $('.emojiWrapper');
            if (e.target != $emojiwrapper) {
                $emojiwrapper.css({'display': 'none'});
            }
        });

        $('.emojiWrapper > img').on('click', function() {
            var $this = $(this),
                $messageInput = $('.messageInput');
            $messageInput.focus().val($messageInput.val() + '[emoji:' + $this.attr('title') +']');
        });

        $('.clearBtn').on('click', function() {
            $('.historyArea > p').remove();
        });

        $('.hideLog').on('click', function() {
            var $this = $(this);
            if ($this.attr('title') === 'hide log') {
                $('.historyArea > li.log').fadeOut(that.FADE_TIME).addClass('hide');
                $this.val('show log').attr('title', 'show log');
                that.FLAGS.hideLog = true;
            } else {
                $('.historyArea > li.log').fadeIn(that.FADE_TIME);
                $this.val('hide log').attr('title', 'hide log').removeClass('hide');
                that.FLAGS.hideLog = false;
            }
            
        });

        $('.nicknameInput').on('keyup', function(e) {
            var $this = $(this);
            if (e.keyCode == 13) {  // enter key
                reg = /^[\u4E00-\u9FA5a-zA-Z0-9_-\s]{2,16}$/;
                that._initUserConfig();   // get nickname from input once, stored in local var
                if (reg.test(that.USER_CONFIG.nickname)) {                
                    that.socket.emit('login', { nickname: that.USER_CONFIG.nickname, isReconnected: false }); // emit 'login' event to server
                } else {
                    $('.info').text('nickname must be 2-16 charactor, including a-z/A-Z/中文/0-9/_/-');
                    $this.focus();
                };
            }
        });

        $('.messageInput').on('keyup', function(e) {
            var $this = $(this),
                msg = $this.val();

            if (that.FLAGS.connected) {
                if (that.FLAGS.comboKeyPressed) {
                    that.FLAGS.comboKeyPressed = false;
                } else if (e.keyCode === 13 && msg.trim().length > 0) {
                    msg = msg.replace(/\s+$/g, '').replace(/\n/g, '<br/>').replace(/\s/g, '&nbsp;');
                    $this.val('');
                    that.socket.emit('postMsg', { message: msg, color: that.USER_CONFIG.color });
                    that._addChatMessage({ nickname: 'me', message: msg, color: that.USER_CONFIG.color }, { isSelf: true});
                    that.socket.emit('stopTyping');
                    that.FLAGS.typing = false;
                } else {
                    $this.focus();
                }
            }            
        }).on('keydown', function(e) {
            var $this = $(this),
                msg = $this.val().replace(/\n+$/g, '');
            if (e.keyCode === 13) {                
                $this.focus();
                $this.val(msg);
            } else if (e.keyCode < 112 || e.keyCode > 123) {    // except F1-F12
                that._updateTyping();
            }            
        }).on('keypress', function(e) {
            var $this = $(this),
                msg = $this.val().replace(/\n+$/g, '');;
            if (e.ctrlKey && e.which === 10) {
                $this.val(msg + '\n');
                that.FLAGS.comboKeyPressed = true;
            } 
        });

        this.socket.on('disconnect', function() {
            that.FLAGS.connected = false;
            that._log({ nickname: 'system', message: 'you have been disconnected', color: '#888' });
        });
        
        this.socket.on('reconnect', function() {
            that._initUserConfig();
            that.FLAGS.connected = true;
            that._log({ nickname: 'system', message: 'you have been reconnected', color: '#888' });
            that.socket.emit('login', { nickname: that.USER_CONFIG.nickname, isReconnected: true });
        });

        this.socket.on('nickExisted', function() {
            $('.info').text('nickname is taken, choose another pls');
        });

        this.socket.on('loginSuccess', function(data) {
            that.FLAGS.connected = true;
            $('title').text('socket-chat | ' + that.USER_CONFIG.nickname);
            $('.loginWrapper').fadeOut(300);
            if (that.FLAGS.firstLogin) {
                $('.historyArea > p').remove();
                that._log({ nickname: 'system', message: 'Welcome ' + that.USER_CONFIG.nickname, color: '#888' });
                that._updateBanner(data);
                that.FLAGS.firstLogin = false;
            }
            $('.messageInput').focus();
        });

        this.socket.on('loginAgain', function(data) {
            that._updateBanner(data);
        });

        this.socket.on('system', function(data) {
            if (data.nickname !== null && that.FLAGS.connected === true) {
                var msg = data.nickname + (data.status.indexOf('login') > -1 ? 
                (data.status === 'login' ? ' joined' : ' rejoined') : ' left');                         
                that._updateBanner(data);
                // that._removeChatTyping(data);
                that._log({ nickname: 'system', message: msg, color: '#888' }) ;
            }            
        });

        this.socket.on('newMsg', function(data) {
            if (that.FLAGS.connected === true) {
                that._addChatMessage(data);
            }            
        });

        this.socket.on('newImg', function(data) {
            if (that.FLAGS.connected === true) {
                that._addImg(data);
            }            
        });

        this.socket.on('typing', function(data) {
            if (that.FLAGS.connected === true) {
                that._addChatTyping(data);
            }            
        });

        this.socket.on('stopTyping', function(data) {
            if (that.FLAGS.connected === true) {
                that._removeChatTyping(data);
            }            
        });
    },

    _addMessageElement: function(el, options) {
        var $el = $(el),
            $container = $('.historyArea');
        options = options || {};

        if (typeof options.fade === 'undefined') {
            options.fade = true;
        }
        if (options.fade) {
            $el.hide().fadeIn(this.FADE_TIME);
        }

        $container.append($el).scrollTop($container[0].scrollHeight);   
    },

    _log: function(data) {
        var date = new Date().toTimeString().substr(0, 8),
            $msgToDisplay = $('<li/>').addClass('log')
            .append('-[' + data.nickname + '] ' + '<span class="timespan">(' + date + '): </span>' + data.message + '-')
            .css('color', data.color);
            if (this.FLAGS.hideLog) {
                $msgToDisplay.addClass('hide');
            }
        this._addMessageElement($msgToDisplay);
    },

    _addChatMessage: function(data, options) {
        var $typingMessages = this._getTypingMessages(data);
        options = options || {};
        if ($typingMessages.length !== 0) {
            options.fade = false;
            $typingMessages.remove();
        }

        var $msgToDisplay = options.isSelf ? $('<li class="rightbox"/>'): $('<li class="leftbox"/>'),
            date = new Date().toTimeString().substr(0, 8),
            typingClass = data.typing ? 'typing' : 'message';
        data.message = data.typing ? data.message : this._addEmoji(data.message);   // if not typing, show emoji
        $msgToDisplay.append('<div><div class=' + 
            (options.isSelf ? '"righthead right"><b class="right">' : '"lefthead"><b class="left">') + '[' + data.nickname + ']</b> ' + 
            (data.typing ? '' : (options.isSelf ? '<span class="timespan right">(' : '<span class="timespan left">(') + date + ')</span></div>') + 
            (data.typing ? data.message : (options.isSelf ? '<div class="msgBox right">' : '<div class="msgBox left">') + data.message + '</div></div>'))        
        .data('nickname', data.nickname)
        .addClass(typingClass)
        .find('b').css({'color': data.color || '#000'});

        this._addMessageElement($msgToDisplay, options);
    },

    _addImg: function(data) {
        var date = new Date().toTimeString().substr(0, 8),
            isSelf = data.nickname === this.USER_CONFIG.nickname ? true : false,
            $msgToDisplay = isSelf ? $('<li class="rightbox image"/>'): $('<li class="leftbox image"/>');
        if (data.nickname === this.USER_CONFIG.nickname) {
            data.nickname = 'me';
        }
        $msgToDisplay.append('<div><div class=' + 
            (isSelf ? '"righthead right"><b class="right">' : '"lefthead"><b class="left">') + '[' + data.nickname + ']</b> ' + 
            (isSelf ? '<span class="timespan right">(' : '<span class="timespan left">(') + date + ')</span></div>' + 
            (isSelf ? '<div class="left img"><a class="right"' :'<div class="left img"><a class="left"') + ' href="/show?src=' + data.src + '" target="_blank">' + 
            (isSelf ? '<img class="right"' : '<img class="left"') + ' src="' + data.src + '"/></a></div>')
        .find('b').css('color', data.color);
        this._addMessageElement($msgToDisplay);
    },

    _addChatTyping: function(data) {
        data.typing = true;
        data.message = 'is typing...';
        this._addChatMessage(data);
    },

    _removeChatTyping: function(data) {
        this._getTypingMessages(data).fadeOut(function() {
            $(this).remove();
        });
    },

    _getTypingMessages: function(data) {
        return $('.typing').filter(function (i) {
            return $(this).data('nickname') === data.nickname;
        });
    },

    _updateTyping: function() {
        var that = this;
        if (this.FLAGS.connected) {
            if (!this.FLAGS.typing) {
                this.FLAGS.typing = true;
                this.socket.emit('typing', { color: this.USER_CONFIG.color });
            }
            this.lastTypingTime = (new Date()).getTime();

            setTimeout(function() {
                var typingTimer = (new Date()).getTime();
                var timeDiff = typingTimer - that.lastTypingTime;
                if (timeDiff >= that.TYPING_TIMER_LENGTH && that.FLAGS.typing) {
                    that.socket.emit('stopTyping');
                    that.FLAGS.typing = false;
                } 
            }, this.TYPING_TIMER_LENGTH);
        }
    },

    _initalEmoji: function() {
        var $emojiWrapper = $('.emojiWrapper');
        for (var i = 69; i > 0; i--) {
            var $emojiItem = $('<img>');
            $emojiItem.attr('src', '../content/emoji/' + i + '.gif');
            $emojiItem.attr('title', i);
            $emojiWrapper.append($emojiItem);
        }
    },

    _addEmoji: function(msg) {
        var match, result = msg,
            reg = /\[emoji:\d+\]/g,
            emojiIndex,
            totalEmojiNum = $('.emojiWrapper > img').length;
        while (match = reg.exec(msg)) {
            emojiIndex = match[0].slice(7, -1);
            if (emojiIndex > totalEmojiNum) {
                result = result.replace(match[0], '[X]');
            } else {
                result =  result.replace(match[0], '<img class="emoji-item" src="../content/emoji/' + emojiIndex + '.gif" />');
            };
        };

        return result;
    },

    _updateBanner: function(data) {
        $('.status').text(data.userCount + (data.userCount > 1 ? ' users' : ' user') + ' online');
    },

    _initUserConfig: function() {
        this.USER_CONFIG.nickname = $('.nicknameInput').val();
        this.USER_CONFIG.color = $('.colorStyle').val();
    }
};