(function () {
    var $clickElem = document.getElementById('click-start');
    $clickElem.addEventListener('click', function () {
        $clickElem.remove();

        var onDOMContentLoaded = function () {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;

            try {
                var context = new AudioContext();
            } catch (error) {
                window.alert(error.message + " : Please use Chrome or Safari.");
                return;
            }

            /* music */

            // for the instance of AudioBufferSourceNode
            var source = null;
            // Create the instance of GainNode (for Master Volume)
            var gain = context.createGain();
            // Create the instance of OscillatorNode (for LFO)
            var lfo = context.createOscillator();

            // Delay
            // Create the instance of DelayNode
            var delay = context.createDelay();
            // for Chorus parameters
            var delay = context.createDelay();
            var depthRate = 0;  // This value must be less than or equal to 1.0 (100%)
            var depth = context.createGain();
            var rate = lfo.frequency;
            var mix = context.createGain();

            // Initialize parameters for Chorus
            delay.delayTime.value = document.getElementById('range-chorus-delay-time').valueAsNumber / 1000;
            depthRate = document.getElementById('range-chorus-depth').valueAsNumber / 100;
            depth.gain.value = delay.delayTime.value * depthRate;
            rate.value = document.getElementById('range-chorus-rate').valueAsNumber;
            mix.gain.value = 0;

            // Trigger 'ended' event
            var trigger = function () {
                var event = document.createEvent('Event');
                event.initEvent('ended', true, true);

                if (source instanceof AudioBufferSourceNode) {
                    source.dispatchEvent(event);
                }
            };

            // This funciton is executed after getting ArrayBuffer of audio data
            var startAudio = function (arrayBuffer) {

                // The 2nd argument for decodeAudioData
                var successCallback = function (audioBuffer) {
                    // The 1st argument (audioBuffer) is the instance of AudioBuffer

                    // If there is previous AudioBufferSourceNode, program stops previous audio
                    if ((source instanceof AudioBufferSourceNode) && (source.buffer instanceof AudioBuffer)) {
                        // Execute onended event handler
                        trigger();
                        source = null;
                    }

                    // Create the instance of AudioBufferSourceNode
                    source = context.createBufferSource();

                    // Set the instance of AudioBuffer
                    source.buffer = audioBuffer;

                    // Set parameters
                    source.playbackRate.value = document.getElementById('range-playback-rate').valueAsNumber;
                    source.loop = document.querySelector('[type="checkbox"]').checked;

                    // GainNode (Master Volume) -> AudioDestinationNode (Output);
                    gain.connect(context.destination);

                    // Connect nodes for original audio
                    // AudioBufferSourceNode (Input) -> GainNode (Master Volume) (-> AudioDestinationNode (Output))
                    source.connect(gain);

                    // Connect nodes for effect (Chorus) sound
                    // AudioBufferSourceNode (Input) -> DelayNode (Delay) -> GainNode (Mix) -> GainNode (Master Volume) (-> AudioDestinationNode (Output))
                    source.connect(delay);
                    delay.connect(mix);
                    mix.connect(gain);

                    // Connect nodes for LFO that changes Delay Time periodically
                    // OscillatorNode (LFO) -> GainNode (Depth) -> delayTime (AudioParam)
                    lfo.connect(depth);
                    depth.connect(delay.delayTime);

                    // Start audio
                    source.start(0);

                    // Start LFO
                    lfo.start(0);

                    // Set Callback
                    source.onended = function (event) {
                        // Remove event handler
                        source.onended = null;
                        document.onkeydown = null;

                        // Stop audio
                        source.stop(0);

                        // Stop LFO
                        var type = lfo.type;
                        var frequency = lfo.frequency.value;
                        var detune = lfo.detune.value;

                        lfo.stop(0);

                        // for next start
                        lfo = context.createOscillator();

                        // Set parametres
                        lfo.type = type;
                        lfo.frequency.value = frequency;
                        lfo.detune.value = detune;

                        // Change reference
                        rate = lfo.frequency;

                        console.log('STOP by "on' + event.type + '" event handler !!');

                        // Audio is not started !!
                        // It is necessary to create the instance of AudioBufferSourceNode again

                        // Cannot replay
                        // source.start(0);
                    };

                    // Stop audio
                    document.onkeydown = function (event) {
                        // Space ?
                        if (event.keyCode !== 32) {
                            return;
                        }

                        // Execute onended event handler
                        trigger();

                        return false;
                    };
                };

                // The 3rd argument for decodeAudioData
                var errorCallback = function (error) {
                    if (error instanceof Error) {
                        window.alert(error.message);
                    } else {
                        window.alert('Error : "decodeAudioData" method.');
                    }
                };

                // Create the instance of AudioBuffer (Asynchronously)
                context.decodeAudioData(arrayBuffer, successCallback, errorCallback);
            }

            /* File Uploader */

            document.getElementById("file-upload-audio").addEventListener(
                "change",
                function (event) {
                    var uploader = this;
                    var progressArea = document.getElementById(
                        "progress-file-upload-audio"
                    );

                    // Get the instance of File (extends Blob)
                    var file = event.target.files[0];

                    if (!(file instanceof File)) {
                        window.alert("Please upload file.");
                    } else if (file.type.indexOf("audio") === -1) {
                        window.alert("Please upload audio file.");
                    } else {
                        // Create the instance of FileReader
                        var reader = new FileReader();

                        reader.onprogress = function (event) {
                            if (event.lengthComputable && event.total > 0) {
                                var rate = Math.floor((event.loaded / event.total) * 100);
                                progressArea.textContent = rate + " %";
                            }
                        };

                        reader.onerror = function () {
                            window.alert(
                                "FileReader Error : Error code is " + reader.error.code
                            );
                            uploader.value = "";
                        };

                        // Success read
                        reader.onload = function () {
                            var arrayBuffer = reader.result; // Get ArrayBuffer

                            startAudio(arrayBuffer);

                            uploader.value = "";
                            progressArea.textContent = file.name;
                        };

                        // Read the instance of File
                        reader.readAsArrayBuffer(file);
                    }
                },
                false
            );

            /* microphone */

            var analyser = context.createAnalyser();
            analyser.smoothingTimeConstant = 0.65; //落ち着くまでの時間
            analyser.fftSize = 1024; //音域の数
            var bufferLength = analyser.frequencyBinCount;
            //↓の配列に音域ごとの大きさが入る
            var dataArray = new Uint8Array(bufferLength);
            analyser.getByteTimeDomainData(dataArray);

            var source = null;

            //マイクの音を拾う
            navigator.webkitGetUserMedia(
                { audio: true },
                function (stream) {
                    source = context.createMediaStreamSource(stream);
                    source.connect(analyser);
                    getAudio();
                },
                function (err) {
                    console.log(err);
                }
            );

            //dataArrayに音域情報を入れる。繰り返す
            function getAudio() {
                requestAnimationFrame(getAudio);
                analyser.getByteFrequencyData(dataArray);
                // console.log(dataArray);

                // 音量として、解析結果の全周波数の振幅の平均を取得する
                var sum = dataArray.reduce(function (acc, cur) {
                    return acc + cur;
                });
                var average = sum / bufferLength;
                var system = average / 5;
            }



            // Control Master Volume
            document.getElementById("range-volume").addEventListener(
                "input",
                function () {
                    var min = gain.gain.minValue || 0;
                    var max = gain.gain.maxValue || 1;

                    if (this.valueAsNumber >= min && this.valueAsNumber <= max) {
                        gain.gain.value = this.valueAsNumber;
                        document.getElementById("output-volume").textContent = this.value;
                    }
                },false);

            // Effect Volume
            document.getElementById("button-volume-mix").addEventListener(
                "click",
                function changeVolume() {
                    gain.gain.value = 0.1;
                    requestAnimationFrame(changeVolume);
                    analyser.getByteFrequencyData(dataArray);
                    var sum = dataArray.reduce(function (acc, cur) {
                        return acc + cur;
                    });
                    var average = sum / bufferLength;
                    var system = average / 10;

                    if (system >= 0 && system <= 1) {
                        gain.gain.value = system;
                        document.getElementById("output-volume-mix").textContent = system;
                    } else if (1 < system) {
                        gain.gain.value = 1;
                        document.getElementById("output-volume-mix").textContent = 1;
                    } else {
                        gain.gain.value = 0;
                        document.getElementById("output-volume-mix").textContent = 0;
                    }

                },false);

            // Control playbackRate
            document.getElementById('range-playback-rate').addEventListener('input', function () {
                if (source instanceof AudioBufferSourceNode) {
                    var min = source.playbackRate.minValue || 0;
                    var max = source.playbackRate.maxValue || 1024;

                    if ((this.valueAsNumber >= min) && (this.valueAsNumber <= max)) {
                        source.playbackRate.value = this.valueAsNumber;
                    }
                }
                document.getElementById('output-playback-rate').textContent = this.value;
            }, false);

            // Toggle loop
            document.querySelector('[type="checkbox"]').addEventListener(EventWrapper.CLICK, function () {
                if (source instanceof AudioBufferSourceNode) {
                    source.loop = this.checked;
                }
            }, false);

            // Control delayTime
            document.getElementById('range-chorus-delay-time').addEventListener('input', function () {
                delay.delayTime.value = this.valueAsNumber / 1000;
                depth.gain.value = delay.delayTime.value * depthRate;
                document.getElementById('output-chorus-delay-time').textContent = this.value;
            }, false);

            // Control Chorus Depath
            document.getElementById('range-chorus-depth').addEventListener('input', function () {
                depth.gain.value = delay.delayTime.value * (this.valueAsNumber / 100);
                depthRate = this.valueAsNumber / 100;
                document.getElementById('output-chorus-depth').textContent = this.value;
            }, false);

            // Control Chorus Rate
            document.getElementById('range-chorus-rate').addEventListener('input', function () {
                rate.value = this.valueAsNumber;
                document.getElementById('output-chorus-rate').textContent = this.value;
            }, false);

            // Control Chorus Mix
            document.getElementById('range-chorus-mix').addEventListener('click',
                function changeMix() {
                    requestAnimationFrame(changeMix);
                    analyser.getByteFrequencyData(dataArray);
                    var sum = dataArray.reduce(function (acc, cur) {
                        return acc + cur;
                    });
                    var average = sum / bufferLength;
                    var system = average / 10;

                    var min = mix.gain.minValue || 0;
                    var max = mix.gain.maxValue || 1;

                    if (system >= min && system <= max) {
                        mix.gain.value = system;
                        document.getElementById("output-chorus-mix").textContent = system;
                    } else if (max <= system) {
                        mix.gain.value = 1;
                        document.getElementById("output-chorus-mix").textContent = 1;
                    }

                }, false);
        };

        if ((document.readyState === 'interactive') || (document.readyState === 'complete')) {
            onDOMContentLoaded();
        } else {
            document.addEventListener('DOMContentLoaded', onDOMContentLoaded, true);
        }

    }, false);

})();


function EventWrapper() { }
(function () {
    var click = '';
    var start = '';
    var move = '';
    var end = '';
    // Touch Panel ?
    if (/iPhone|iPad|iPod|Android/.test(navigator.userAgent)) {
        click = 'click';
        start = 'touchstart';
        move = 'touchmove';
        end = 'touchend';
    } else {
        click = 'click';
        start = 'mousedown';
        move = 'mousemove';
        end = 'mouseup';
    }
    EventWrapper.CLICK = click;
    EventWrapper.START = start;
    EventWrapper.MOVE = move;
    EventWrapper.END = end;
})();
