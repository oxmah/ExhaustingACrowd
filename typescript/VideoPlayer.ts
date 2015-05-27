/// <reference path="../typings/tsd.d.ts" />
declare var bowser:any;

interface EventHandler {
    (player: VideoPlayer): void;
}


interface IVideoPlayerCallbacks {
    onLoadComplete?: EventHandler;
    onNewFrame?: EventHandler;
}

class VideoPlayer {
    ytplayer:YT.Player;

    aspect = 16.0/9.0;
    zoom = 1.0;
    zoomPos = {x:0, y:0};
    loading = true;
    startTimes = [];
    durations = [7650, 4941, 7424, 7264, 6835, 7128];
    public totalDur  = 0;
    /** Current time in millis **/
    currentTime: number = 0;

    // Events
    events:IVideoPlayerCallbacks;

    constructor(events : IVideoPlayerCallbacks){

        // Populate the startTimes array
        var _dur=0;
        for(var i=0;i<this.durations.length;i++){
            this.startTimes.push(_dur);
            _dur += this.durations[i]*1000;
        }
        this.startTimes.push(_dur);

        this.totalDur = _dur;

        this.events = events;

        this.ytplayer = new YT.Player('ytplayer', {
            height: 390,
            width: 640,
            // videoId: '',
            playerVars: {
                autoplay: 1,    //< Play on start
                controls: 0,    //< Hide controls
                disablekb: 1,   //< Disable keyboard controls
                enablejsapi: 1, //< Enable js api
                fs: 0,          // Disable fullscreen
                modestbranding: 1, //< Thank you youtube for the offer of branding, but no thanks
                origin:'localhost', // Should be set for security
                rel: 0,          //< Dont show related videos
                showinfo: 0,    //< Hide info
                list: 'PLscUku2aaZnFE-7wKovrbi76b26VKxIT-',
                listType: 'playlist',
                start:0
            },
            events: {
                'onReady': () => {this.onPlayerReady()},
                'onStateChange': () => {this.onPlayerStateChange()},
                //'onPlaybackQualityChange': onPlayerPlaybackQualityChange
            }
        });

    }





    updatePlayerSize(){
        var player = $('#videocontainer');

        var size = this.calculatePlayerSize();

        player.css({
            left: size.left,
            top: size.top-50,
            width: size.width,
            height: size.height+100
        });

        //updateMouseTrail();
    }

    clientToVideoCoord(clientX:number, clientY:number){
        var playerSize = this.calculatePlayerSize();

        var ret = {
            x: clientX,
            y: clientY
        };

        ret.x -= playerSize.left;
        ret.y -= playerSize.top;
        ret.x /= playerSize.width;
        ret.y /= playerSize.height;

        return ret;
    }

    videoToClientCoord(videoX:number, videoY:number){
        var playerSize =this.calculatePlayerSize();

        var ret = {
            x: videoX,
            y: videoY
        };

        ret.x *= playerSize.width;
        ret.y *= playerSize.height;
        ret.x += playerSize.left;
        ret.y += playerSize.top;

        return ret;
    }

    calculatePlayerSize(){
        var left = 0;
        var top = 0;

        if($(window).width() / $(window).height() >  this.aspect){
            var width = $(window).width() ;
            var height = $(window).width() / this.aspect;
            top = -(height - $(window).height())/2;

        } else {
            var width = $(window).height() * this.aspect;
            var height = $(window).height();
            left = -(width - $(window).width())/2;
        }

        if(this.zoom != 1){
            width *= this.zoom;
            height*= this.zoom;

            left = -this.zoomPos.x * width + $(window).width() * 0.25;
            top = -this.zoomPos.y * height + $(window).height() * 0.5;
        }

        return {left: left, top: top, width:width, height:height};
    }


    private _last_time_update:number;
    frameUpdate(){
        var time_update = this.ytplayer.getCurrentTime()*1000;
        //console.log(time_update);
        var playing = this.ytplayer.getPlayerState();

        if (playing==1) {

            if (this._last_time_update == time_update) {
                this.currentTime += 10;
            }

            if (this._last_time_update != time_update) {
                this.currentTime = time_update;
                //console.log(time_update);
                if(this.startTimes[this.ytplayer.getPlaylistIndex()]){
                    this.currentTime += this.startTimes[this.ytplayer.getPlaylistIndex()];
                }

                //clockTime = new Date("April 15, 2015 11:13:00");
                //clockTime.setSeconds(clockTime.getSeconds()+ time_update/1000)
            }

        }

        this._last_time_update = time_update;


        if(this.events.onNewFrame) this.events.onNewFrame(this);
        /*        updateAnimation();
         updateNotes();
         updateVideoLoop();*/


    }

    seek(ms:number, cb?:(()=>void)){
        ms = ms % this.totalDur;
        console.log(ms, this.startTimes);
        for(var i=0;i<this.startTimes.length-1;i++){
            if(ms < this.startTimes[i+1]){
                if(this.ytplayer.getPlaylistIndex() != i){
                    console.log("Play video at "+ i);
                    this.ytplayer.playVideoAt(i);
                }
                if(this.startTimes[i]) {
                    ms -= this.startTimes[i];
                }
                break;
            }
        }

        if(ms < 0){
            ms = 0;
        }
        // Wait for the video having seeked
        var stateChange = (e)=>{
            if(e.data == 1) {
                var removeCast : any = this.ytplayer;
                removeCast.removeEventListener("onStateChange", stateChange);
                if(cb)cb();
            }
        };

        // In safari, seekTo doesn't trigger a state change, so we just callback
        if(bowser.safari) {
            if(cb)cb();
        } else {
            this.ytplayer.addEventListener("onStateChange", stateChange)
        }

        this.ytplayer.seekTo(ms/1000, true);
        this.currentTime = ms;
        if(this.startTimes[this.ytplayer.getPlaylistIndex()]){
            this.currentTime += this.startTimes[this.ytplayer.getPlaylistIndex()];
        }
    }

    onPlayerReady(){
        this.updatePlayerSize();
    }

    onPlayerStateChange(){

        this.ytplayer.mute();

        if(this.ytplayer.getPlayerState() == 0){
            this.seek(0);
        }

        if(this.loading && this.ytplayer.getPlayerState() == 1){
            this.loading = false;

            if(this.events.onLoadComplete){
                this.events.onLoadComplete(this);
            }
            setInterval(()=>{this.frameUpdate()}, 10);
        }
    }

    setClock(time:string, cb?:(()=>void)){
        var t = moment(time,['H:mm', 'HH:mm']);
        var t2 = moment(Clock.startTime);
        t2.hour(t.hour())
        t2.minute(t.minute());

        if(t2.isBefore(moment(Clock.startTime))){
            t2 = t2.add(1, 'days');
        }

        var diff = -moment(Clock.startTime).diff(t2)  % (1000*60*60*12);
        if(diff < 0) diff += video.totalDur;
        video.seek(diff, cb);
    }
}

