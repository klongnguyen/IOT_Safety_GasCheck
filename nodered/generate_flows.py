import json

flows = [
    {
        "id": "tab_gascheck",
        "type": "tab",
        "label": "GasCheck V2 - N19 Middleware",
        "disabled": False,
        "info": "Flow Middleware xu ly du lieu IoT va Automation Rules cho He thong Canh bao Ro ri Gas Nhom N19"
    },
    {
        "id": "mqtt_broker_hivemq",
        "type": "mqtt-broker",
        "name": "HiveMQ Public Broker",
        "broker": "broker.hivemq.com",
        "port": "1883",
        "clientid": "nodered_n19_middleware",
        "autoConnect": True,
        "usetls": False,
        "protocolVersion": "4",
        "keepalive": "60",
        "cleansession": True,
        "autoUnsubscribe": True
    },
    # UI Base config
    {
        "id": "ui_tab_main",
        "type": "ui_tab",
        "name": "GasCheck N19 Monitor",
        "icon": "dashboard",
        "order": 1
    },
    {
        "id": "ui_group_sensor",
        "type": "ui_group",
        "name": "1. Giam sat Nong do Gas (MQ2)",
        "tab": "ui_tab_main",
        "order": 1,
        "disp": True,
        "width": "6",
        "collapse": False
    },
    {
        "id": "ui_group_actuators",
        "type": "ui_group",
        "name": "2. Trang thai Co cau & Canh bao",
        "tab": "ui_tab_main",
        "order": 2,
        "disp": True,
        "width": "6",
        "collapse": False
    },
    {
        "id": "ui_group_control",
        "type": "ui_group",
        "name": "3. Dieu khien & Test an toan",
        "tab": "ui_tab_main",
        "order": 3,
        "disp": True,
        "width": "6",
        "collapse": False
    },
    {
        "id": "ui_group_events",
        "type": "ui_group",
        "name": "4. Nhat ky Su kien (Event History)",
        "tab": "ui_tab_main",
        "order": 4,
        "disp": True,
        "width": "12",
        "collapse": False
    },

    # --- 1. TELEMETRY INGESTION ---
    {
        "id": "node_mqtt_telemetry_in",
        "type": "mqtt in",
        "z": "tab_gascheck",
        "name": "Sub: Telemetry",
        "topic": "gascheck/n19/telemetry",
        "qos": "0",
        "datatype": "auto-detect",
        "broker": "mqtt_broker_hivemq",
        "x": 140,
        "y": 100,
        "wires": [["node_json_telemetry"]]
    },
    {
        "id": "node_json_telemetry",
        "type": "json",
        "z": "tab_gascheck",
        "name": "Parse JSON",
        "property": "payload",
        "action": "",
        "pretty": False,
        "x": 320,
        "y": 100,
        "wires": [["node_fn_telemetry_processor", "node_fn_automation_escalation"]]
    },
    {
        "id": "node_fn_telemetry_processor",
        "type": "function",
        "z": "tab_gascheck",
        "name": "Middleware Data Processor & Context Storage",
        "func": """// Luu tru context vao flow memory
var data = msg.payload;
if (!data || typeof data !== 'object') return null;

flow.set('currentGas', data.gas_filtered || data.gas_raw || 0);
flow.set('currentState', data.state || 'UNKNOWN');
flow.set('lastTelemetryTime', Date.now());
flow.set('windowStatus', data.window || 'UNKNOWN');
flow.set('buzzerStatus', data.buzzer ? 'ON' : 'OFF');

// Tao cac message rieng cho Dashboard va Debug
var msgGas = { payload: data.gas_filtered, topic: 'gas' };
var msgState = { payload: 'Trang thai: ' + data.state, topic: 'state' };
var msgWindow = { payload: 'Cua so: ' + data.window, topic: 'window' };
var msgBuzzer = { payload: 'Coi bao dong: ' + (data.buzzer ? 'ON' : 'OFF'), topic: 'buzzer' };

return [msg, msgGas, msgState, msgWindow, msgBuzzer];""",
        "outputs": 5,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 570,
        "y": 100,
        "wires": [
            ["node_debug_telemetry"],
            ["ui_gauge_gas"],
            ["ui_text_state"],
            ["ui_text_window"],
            ["ui_text_buzzer"]
        ]
    },
    {
        "id": "node_debug_telemetry",
        "type": "debug",
        "z": "tab_gascheck",
        "name": "Log: Telemetry",
        "active": True,
        "tosidebar": True,
        "console": False,
        "tostatus": False,
        "complete": "payload",
        "targetType": "msg",
        "statusVal": "",
        "statusType": "auto",
        "x": 860,
        "y": 60,
        "wires": []
    },

    # --- 2. EVENT INGESTION & HISTORY LOGGING ---
    {
        "id": "node_mqtt_event_in",
        "type": "mqtt in",
        "z": "tab_gascheck",
        "name": "Sub: Events",
        "topic": "gascheck/n19/event",
        "qos": "1",
        "datatype": "auto-detect",
        "broker": "mqtt_broker_hivemq",
        "x": 130,
        "y": 240,
        "wires": [["node_json_event"]]
    },
    {
        "id": "node_json_event",
        "type": "json",
        "z": "tab_gascheck",
        "name": "Parse Event JSON",
        "property": "payload",
        "action": "",
        "pretty": False,
        "x": 330,
        "y": 240,
        "wires": [["node_fn_event_logger"]]
    },
    {
        "id": "node_fn_event_logger",
        "type": "function",
        "z": "tab_gascheck",
        "name": "Rule & Event History Buffer",
        "func": """var eventData = msg.payload;
var logs = flow.get('eventLogs') || [];

var now = new Date();
var timeStr = now.toLocaleTimeString('vi-VN') + ' ' + now.toLocaleDateString('vi-VN');

var logEntry = {
    time: timeStr,
    event: eventData.event || eventData.command || 'EVENT',
    detail: JSON.stringify(eventData)
};

// Them vao dau danh sach, giu toi da 20 su kien gan nhat
logs.unshift(logEntry);
if (logs.length > 20) logs.pop();
flow.set('eventLogs', logs);

// Tao dinh dang HTML hien thi tren Dashboard
var html = '<table style=\"width:100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px;\">';
html += '<tr style=\"background:#1e293b; color:#fff; text-align:left;\"><th style=\"padding:6px;\">Thoi gian</th><th style=\"padding:6px;\">Su kien</th><th style=\"padding:6px;\">Chi tiet</th></tr>';

for (var i = 0; i < logs.length; i++) {
    var bg = (i % 2 === 0) ? '#f8fafc' : '#ffffff';
    var color = '#0f172a';
    if (logs[i].detail.indexOf('DANGER') !== -1 || logs[i].detail.indexOf('REJECTED') !== -1) {
        color = '#dc2626';
    } else if (logs[i].detail.indexOf('ACCEPTED') !== -1) {
        color = '#16a34a';
    }
    html += '<tr style=\"background:' + bg + '; color:' + color + ';\">';
    html += '<td style=\"padding:6px; border-bottom:1px solid #e2e8f0;\">' + logs[i].time + '</td>';
    html += '<td style=\"padding:6px; border-bottom:1px solid #e2e8f0; font-weight:bold;\">' + logs[i].event + '</td>';
    html += '<td style=\"padding:6px; border-bottom:1px solid #e2e8f0;\">' + logs[i].detail + '</td>';
    html += '</tr>';
}
html += '</table>';

return [ { payload: eventData }, { payload: html } ];""",
        "outputs": 2,
        "noerr": 0,
        "x": 550,
        "y": 240,
        "wires": [
            ["node_debug_event"],
            ["ui_template_event_history"]
        ]
    },
    {
        "id": "node_debug_event",
        "type": "debug",
        "z": "tab_gascheck",
        "name": "Log: Event Occurred",
        "active": True,
        "tosidebar": True,
        "complete": "payload",
        "targetType": "msg",
        "x": 870,
        "y": 220,
        "wires": []
    },

    # --- 3. AUTOMATION RULE 1: HIGH GAS SUSTAINED ESCALATION ---
    {
        "id": "node_fn_automation_escalation",
        "type": "function",
        "z": "tab_gascheck",
        "name": "Automation Rule 1: High Gas Sustained Alarm",
        "func": """// Automation Rule: Kiem tra ro ri gas keo dai
var data = msg.payload;
if (!data || typeof data !== 'object') return null;

var dangerCounter = flow.get('dangerCounter') || 0;

if (data.state === 'DANGER' || (data.gas_filtered && data.gas_filtered >= 2500)) {
    dangerCounter++;
    flow.set('dangerCounter', dangerCounter);
    
    // Neu muc DANGER duy tri tu 3 chu ky telemetry lien tiep (~6 giay tro len)
    if (dangerCounter === 3) {
        var alertMsg = {
            payload: {
                rule: 'SUSTAINED_DANGER_ESCALATION',
                severity: 'CRITICAL',
                message: 'CANH BAO KHAN CAP CAP DO 2: Gas duy tri muc nguy hiem vuot nguong 6 giay! De nghi so tan ngay!',
                gas_level: data.gas_filtered,
                time: new Date().toISOString()
            }
        };
        return alertMsg;
    }
} else {
    // Reset bo dem khi gas giam xuong
    flow.set('dangerCounter', 0);
}
return null;""",
        "outputs": 1,
        "noerr": 0,
        "x": 590,
        "y": 160,
        "wires": [["node_debug_escalation"]]
    },
    {
        "id": "node_debug_escalation",
        "type": "debug",
        "z": "tab_gascheck",
        "name": "ESCALATION ALERT!",
        "active": True,
        "tosidebar": True,
        "complete": "payload",
        "x": 890,
        "y": 160,
        "wires": []
    },

    # --- 4. AUTOMATION RULE 2: SAFETY INTERLOCK RESET DISPATCHER ---
    {
        "id": "ui_btn_reset",
        "type": "ui_button",
        "z": "tab_gascheck",
        "name": "Button Reset",
        "group": "ui_group_control",
        "order": 1,
        "width": "6",
        "height": "1",
        "passthru": False,
        "label": "🔄 YEU CAU RESET HE THONG",
        "tooltip": "Chi gui duoc khi gas da ha xuong muc an toan",
        "color": "#ffffff",
        "bgcolor": "#0284c7",
        "icon": "refresh",
        "payload": "TRIGGER_RESET",
        "payloadType": "str",
        "topic": "reset",
        "x": 130,
        "y": 380,
        "wires": [["node_fn_safety_interlock_check"]]
    },
    {
        "id": "node_fn_safety_interlock_check",
        "type": "function",
        "z": "tab_gascheck",
        "name": "Automation Rule 2: Middleware Safety Interlock Check",
        "func": """// Kiem tra an toan tai Middleware truoc khi cho phep phat lenh xuong ESP32
var currentGas = flow.get('currentGas') || 0;
var currentState = flow.get('currentState') || 'UNKNOWN';

// Neu he thong dang DANGER hoac gas vuot muc an toan (>= 1300)
if (currentState === 'DANGER' || currentGas >= 1300) {
    node.warn('SAFETY INTERLOCK BLOCKED: Gas hien tai la ' + currentGas + ' (vuot nguong an toan 1300). Middleware tu choi gui lenh reset!');
    
    // Log su kien bi chan vao history
    var logs = flow.get('eventLogs') || [];
    logs.unshift({
        time: new Date().toLocaleTimeString('vi-VN'),
        event: 'MIDDLEWARE_BLOCKED_RESET',
        detail: 'Tu choi reset vi Gas = ' + currentGas + ' (State: ' + currentState + ')'
    });
    flow.set('eventLogs', logs);
    
    return [null, { payload: 'CANH BAO: Nong do gas con cao (' + currentGas + '). Tu choi reset de bao ve an toan!' }];
}

// Neu an toan -> Dong y phat goi tin xuong ESP32
var cmdPayload = {
    cmd: 'REQUEST_RESET'
};
return [{ payload: JSON.stringify(cmdPayload) }, null];""",
        "outputs": 2,
        "noerr": 0,
        "x": 450,
        "y": 380,
        "wires": [
            ["node_mqtt_cmd_out", "node_debug_downlink"],
            ["node_debug_blocked"]
        ]
    },
    {
        "id": "node_mqtt_cmd_out",
        "type": "mqtt out",
        "z": "tab_gascheck",
        "name": "Pub: Downlink Command",
        "topic": "gascheck/n19/cmd",
        "qos": "1",
        "retain": "false",
        "respTopic": "",
        "contentType": "",
        "userProps": "",
        "correl": "",
        "expiry": "",
        "broker": "mqtt_broker_hivemq",
        "x": 860,
        "y": 360,
        "wires": []
    },
    {
        "id": "node_debug_downlink",
        "type": "debug",
        "z": "tab_gascheck",
        "name": "Downlink Sent",
        "active": True,
        "tosidebar": True,
        "complete": "payload",
        "x": 840,
        "y": 400,
        "wires": []
    },
    {
        "id": "node_debug_blocked",
        "type": "debug",
        "z": "tab_gascheck",
        "name": "Reset Blocked!",
        "active": True,
        "tosidebar": True,
        "complete": "payload",
        "x": 840,
        "y": 440,
        "wires": []
    },

    # --- 5. AUTOMATION RULE 3: TEST ALARM DISPATCHER ---
    {
        "id": "ui_btn_test_alarm",
        "type": "ui_button",
        "z": "tab_gascheck",
        "name": "Button Test Coi",
        "group": "ui_group_control",
        "order": 2,
        "width": "6",
        "height": "1",
        "passthru": False,
        "label": "🔔 TEST COI BAO DONG (2s)",
        "tooltip": "Kiem tra hoat dong cua coi tu xa",
        "color": "#ffffff",
        "bgcolor": "#eab308",
        "icon": "volume-up",
        "payload": "{\"cmd\":\"TEST_ALARM\"}",
        "payloadType": "str",
        "topic": "test_alarm",
        "x": 140,
        "y": 480,
        "wires": [["node_mqtt_cmd_out"]]
    },

    # --- 6. WATCHDOG SCHEDULER & HEARTBEAT MONITOR ---
    {
        "id": "node_inject_watchdog",
        "type": "inject",
        "z": "tab_gascheck",
        "name": "Watchdog Timer (5s)",
        "props": [{"p": "payload"}],
        "repeat": "5",
        "crontab": "",
        "once": True,
        "onceDelay": 0.1,
        "topic": "",
        "payload": "CHECK_HEARTBEAT",
        "payloadType": "str",
        "x": 160,
        "y": 560,
        "wires": [["node_fn_watchdog"]]
    },
    {
        "id": "node_fn_watchdog",
        "type": "function",
        "z": "tab_gascheck",
        "name": "Rule 4: Network Liveness Watchdog",
        "func": """var lastTime = flow.get('lastTelemetryTime');
if (!lastTime) {
    return { payload: 'Dang cho goi tin telemetry dau tien tu ESP32...' };
}

var diff = Date.now() - lastTime;
if (diff > 10000) {
    return {
        payload: {
            alert: 'DEVICE_OFFLINE',
            message: 'CANH BAO: Thiet bi mat tin hieu qua 10 giay! Kiem tra nguon hoac Wi-Fi.',
            last_seen_sec_ago: Math.round(diff / 1000)
        }
    };
} else {
    return { payload: 'Thiet bi dang hoat dong binh thuong. Do tre: ' + Math.round(diff / 1000) + 's' };
}""",
        "outputs": 1,
        "noerr": 0,
        "x": 440,
        "y": 560,
        "wires": [["node_debug_watchdog"]]
    },
    {
        "id": "node_debug_watchdog",
        "type": "debug",
        "z": "tab_gascheck",
        "name": "Heartbeat Status",
        "active": True,
        "tosidebar": True,
        "complete": "payload",
        "x": 840,
        "y": 560,
        "wires": []
    },

    # --- 7. DASHBOARD UI NODES ---
    {
        "id": "ui_gauge_gas",
        "type": "ui_gauge",
        "z": "tab_gascheck",
        "name": "Gauge Gas MQ-2",
        "group": "ui_group_sensor",
        "order": 1,
        "width": "6",
        "height": "4",
        "gtype": "gage",
        "title": "Nong do Gas (ADC 12-bit)",
        "label": "ADC",
        "format": "{{value}}",
        "min": 0,
        "max": 4095,
        "colors": ["#16a34a", "#eab308", "#dc2626"],
        "seg1": "1500",
        "seg2": "2500",
        "x": 860,
        "y": 100,
        "wires": []
    },
    {
        "id": "ui_text_state",
        "type": "ui_text",
        "z": "tab_gascheck",
        "name": "UI State Text",
        "group": "ui_group_actuators",
        "order": 1,
        "width": "6",
        "height": "1",
        "format": "<b>{{msg.payload}}</b>",
        "layout": "row-spread",
        "x": 860,
        "y": 620,
        "wires": []
    },
    {
        "id": "ui_text_window",
        "type": "ui_text",
        "z": "tab_gascheck",
        "name": "UI Window Text",
        "group": "ui_group_actuators",
        "order": 2,
        "width": "6",
        "height": "1",
        "format": "<b>{{msg.payload}}</b>",
        "layout": "row-spread",
        "x": 860,
        "y": 660,
        "wires": []
    },
    {
        "id": "ui_text_buzzer",
        "type": "ui_text",
        "z": "tab_gascheck",
        "name": "UI Buzzer Text",
        "group": "ui_group_actuators",
        "order": 3,
        "width": "6",
        "height": "1",
        "format": "<b>{{msg.payload}}</b>",
        "layout": "row-spread",
        "x": 860,
        "y": 700,
        "wires": []
    },
    {
        "id": "ui_template_event_history",
        "type": "ui_template",
        "z": "tab_gascheck",
        "name": "UI Event Table",
        "group": "ui_group_events",
        "order": 1,
        "width": "12",
        "height": "6",
        "format": "<div ng-bind-html=\"msg.payload\"></div>",
        "storeOutMessages": True,
        "fwdInMessages": True,
        "resendOnRefresh": True,
        "templateScope": "local",
        "x": 860,
        "y": 280,
        "wires": [[]]
    }
]

with open("nodered/flows.json", "w", encoding="utf-8") as f:
    json.dump(flows, f, indent=2, ensure_ascii=False)
print("Generated nodered/flows.json successfully!")
