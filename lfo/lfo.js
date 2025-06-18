module.exports = function (RED) {
    function LFONode (config) {
        const osc = require('oscillators');
        const clock = require('since-when');

        RED.nodes.createNode(this, config);
        var node = this;
        node.lfo = null;

        // 初始化配置
        node.name = config.name || "";
        node.waveform = config.waveform || "sine";
        node.frequency = config.frequency || 1;
        node.samplingrate = config.samplingrate || 20;
        node.range = config.range || "offsetamplitude";
        node.offset = config.offset || 0;
        node.amplitude = config.amplitude || 1;
        node.min = config.min || -1;
        node.max = config.max || 1;

        // 设置初始波形
        setWaveform(node.waveform);
        setScale();
        
        node.on('input', function (msg) {
            if (!isNaN(msg.payload) && !msg.topic) {
                msg.topic = 'frequency';
            }

            // 处理配置更新
            if (msg.topic) {
                switch(msg.topic.toLowerCase()) {
                    case 'frequency':
                        node.frequency = firstNumber(msg.payload, node.frequency);
                        break;
                    case 'waveform':
                        setWaveform(msg.payload);
                        break;
                    case 'offset':
                        node.offset = firstNumber(msg.payload, node.offset);
                        node.range = 'offsetamplitude';
                        setScale();
                        break;
                    case 'amplitude':
                        node.amplitude = firstNumber(msg.payload, node.amplitude);
                        node.range = 'offsetamplitude';
                        setScale();
                        break;
                    case 'min':
                        node.min = firstNumber(msg.payload, node.min);
                        node.range = 'minmax';
                        setScale();
                        break;
                    case 'max':
                        node.max = firstNumber(msg.payload, node.max);
                        node.range = 'minmax';
                        setScale();
                        break;
                }
            }

            if (msg.payload === 'stop') {
                if (node.lfo) {
                    clearInterval(node.lfo);
                    node.lfo = null;
                }
                return;
            }

            if (msg.payload === 'start' && !node.lfo) {
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
            switch (node.range) {
            case 'minmax':
                node.min = firstNumber(node.min, config.min, -1);
                node.max = firstNumber(node.max, config.max, 1);

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
