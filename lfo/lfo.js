module.exports = function (RED) {
    function LFONode (config) {
        const osc = require('oscillators');
        const clock = require('since-when');
        const nrc = require('../../node-red-contrib-configure/node-red-configure');

        RED.nodes.createNode(this, config);
        var node = this;
        node.lfo = null;


        let configuration = new nrc.NodeRedConfigure(node, config,
            {
                name: {value:""},
                waveform: {value: "sine"},
                frequency: {value: 1},
                samplingrate: {value: 20},
                range: {value: "offsetamplitude"},
                offset: {value: 0},
                amplitude: {value: 1},
                min: {value: -1},
                max: {value: 1}
            });

        configuration.handle(setWaveform, 'waveform');
        setWaveform(config.waveform || 'sine');
        configuration.postHandle(setScale);
        configuration.postHandle(function (){ node.range = 'minmax'; setScale();}, ['min', 'max']);
        configuration.postHandle(function (){ node.range = 'offsetamplitude'; setScale();}, ['offset', 'amplitude']);
        setScale();
        
        node.on('input', function (msg) {
            if (!isNaN(msg.payload) && !msg.topic) {
                msg.topic = 'frequency';
            }

            configuration.input(msg);

            if (msg.payload === 'stop') {
                if (node.lfo) {
                    clearInterval(node.lfo);
                    node.lfo = null;
                }
                return;
            }

            if (msg.payload ==='start' && !node.lfo) {
                node.time = new clock();
                node.lfo = setInterval(function () {
                    if (!(node.oscillator instanceof Function)) {
                        node.warn('No oscillator');
                        return;
                    }
                    let oscBase = node.oscillator(node.time.sinceBeginNS() / 1e9, node.frequency);
                    msg.payload = node.offset_ + node.amplitude_ * oscBase;
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
            if (!node.range) {
                node.range = config.range;
            }
            switch (node.range) {
            case 'minmax':
                node.min = firstNumber(node.min, config.min, -1);
                node.max = firstNumber(node.max, config.max, 1); ;

                node.offset_ = (node.min + node.max) / 2;
                node.amplitude_ = node.max - node.offset_;
                break;

            case 'offsetamplitude':
            default:
                node.offset_ = firstNumber(node.offset, config.offset, 0);
                node.amplitude_ = firstNumber(node.amplitude, config.amplitude, 1);
            }
        }

        function defaultNumber (a, b) {
            // JS is weird: isNaN("") is false
            if ((typeof a) === 'string') {
                a = a.trim();
                if (a.length === 0) {
                    return b;
                }
            }
            let aa = Number(a);
            let result = isNaN(aa) ? Number(b) : aa;
            return result;
        }

        function firstNumber (...theArgs) {
            return theArgs.reduce(function(previous, current){ return defaultNumber(previous, current)});
        }
    }
    RED.nodes.registerType('lfo-node', LFONode);
};
