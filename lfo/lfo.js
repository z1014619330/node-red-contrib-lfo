module.exports = function (RED) {
    function LFONode (config) {
        const osc = require('oscillators');
        const clock = require('since-when');

        RED.nodes.createNode(this, config);
        var node = this;
        node.lfo = null;

        setWaveform(config.waveform);
        node.frequency = config.frequency;
        node.samplingrate = config.samplingrate;

        setScale();

        node.on('input', function (msg) {
            if (!isNaN(msg.payload)) {
                node.frequency = msg.payload;
                return;
            }

            if (msg.hasOwnProperty('waveform')) {
                setWaveform(msg.waveform);
                return;
            }

            if (msg.payload === 'stop') {
                if (node.lfo) {
                    clearInterval(node.lfo);
                    node.lfo = null;
                }
                return;
            }

            if (!node.lfo) {
                node.time = new clock();
                node.lfo = setInterval(function () {
                    if (!(node.oscillator instanceof Function)) {
                        node.warn('No oscillator');
                        return;
                    }
                    let oscBase = node.oscillator(node.time.sinceBeginNS() / 1e9, node.frequency);
                    msg.payload = node.offset + node.amplitude * oscBase;
                    node.send(msg);
                }, node.samplingrate);
            }
        });

        node.on('close', function () {
            if (node.lfo) {
                clearInterval(node.lfo);
                node.lfo = null;
            }
        });

        function setWaveform (waveform) {
            if (!['sine', 'saw', 'saw_i', 'triangle', 'square', 'sig'].includes(waveform)) {
                node.warn('Not a valid waveform: ' + waveform);
                return;
            }

            let oscillator = osc[waveform];
            if (!(oscillator instanceof Function)) {
                node.warn('No oscillator function defined for: ' + waveform);
                return;
            }

            node.waveform = waveform;
            node.oscillator = oscillator;
        }

        function setScale () {
            if(!node.range) {
                node.range = config.range;
            }
            switch (node.range) {
            case 'minmax':
                node.min = firstNumber(node.min, config.min, -1);
                node.max = firstNumber(node.max, config.max, 1); ;

                node.offset = (node.min + node.max) / 2;
                node.amplitude = node.max - node.offset;
                break;

            case 'offsetamplitude':
            default:
                node.offset = firstNumber(node.offset, config.offset, 0);
                node.amplitude = firstNumber(node.amplitude, config.amplitude, 1);
            }
        }

        function defaultNumber (a, b) {
            // JS is weird: isNaN("") is false
            if((typeof a) === "string"){
                a = a.trim();
                if (a.length === 0);
                return b;
            }
            let aa = Number(a);
            return isNaN(aa) ? Number(b) : aa;
        }

        function firstNumber (...theArgs) {
            return theArgs.reduce((previous, current) => defaultNumber(previous, current));
        }
    }
    RED.nodes.registerType('lfo-node', LFONode);
};
