"""
Generates the demo product-evidence PDFs used by the iLumos prototype.
Not needed to run the app; the generated files already live in public/demo-files/.

Every sentence the app cites sits on a single drawn line, so the in-browser
PDF parser can find it and report an exact page and line number.
"""
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
import os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "."
W, H = letter
INK = HexColor("#1F2430"); MUTED = HexColor("#6B7280"); RULE = HexColor("#D1D5DB")


def doc(path, title, meta, pages, brand="ACME CORP.", footer=""):
    c = canvas.Canvas(path, pagesize=letter)
    c.setTitle(title); c.setAuthor("Acme Corp. (fictional, demo data)")
    total = len(pages)
    for pi, lines in enumerate(pages, start=1):
        y = H - 64
        c.setFont("Helvetica-Bold", 8.5); c.setFillColor(MUTED)
        c.drawString(60, y, brand)
        c.drawRightString(W - 60, y, meta)
        c.setStrokeColor(RULE); c.setLineWidth(0.6); c.line(60, y - 8, W - 60, y - 8)
        y -= 40
        for kind, text in lines:
            if kind == "title":
                c.setFont("Helvetica-Bold", 17); c.setFillColor(INK); c.drawString(60, y, text); y -= 24
            elif kind == "sub":
                c.setFont("Helvetica", 10); c.setFillColor(MUTED); c.drawString(60, y, text); y -= 26
            elif kind == "h":
                y -= 6
                c.setFont("Helvetica-Bold", 11.5); c.setFillColor(INK); c.drawString(60, y, text); y -= 19
            elif kind == "code":
                c.setFont("Courier", 9.6); c.setFillColor(INK); c.drawString(78, y, text); y -= 15
            elif kind == "gap":
                y -= 8
            else:
                c.setFont("Helvetica", 10); c.setFillColor(INK); c.drawString(60, y, text); y -= 16
        c.setFont("Helvetica", 8); c.setFillColor(MUTED)
        c.drawString(60, 42, footer or "Fictional document created for the iLumos prototype. Not a real Acme product.")
        c.drawRightString(W - 60, 42, f"Page {pi} of {total}")
        c.showPage()
    c.save()


P = "p"
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- spec sheet
doc(os.path.join(OUT, "Acme_SmartTherm_Technical_Specifications_AT-SPEC-3200.pdf"),
    "SmartTherm Technical Specifications", "AT-SPEC-3200  Rev. C", [
    [("title", "SmartTherm Technical Specifications"),
     ("sub", "Document AT-SPEC-3200, Revision C, January 2024"),
     (P, "Covers: SmartTherm Lite (AT-2100) and SmartTherm Pro (AT-3200)."),
     ("h", "1. Product overview"),
     (P, "SmartTherm is a line of connected thermostats for residential HVAC systems."),
     (P, "Built-in motion sensor detects when people are home."),
     (P, "Both models can be controlled at the device or through the Acme Home mobile app."),
     ("h", "2. Model comparison"),
     (P, "Connectivity, SmartTherm Lite (AT-2100): Wi-Fi 802.11 b/g/n, 2.4 GHz only."),
     (P, "Connectivity, SmartTherm Pro (AT-3200): Wi-Fi 802.11 b/g/n/ac, dual-band 2.4 / 5 GHz,"),
     (P, "plus Bluetooth 5.0 LE."),
     (P, "Occupancy sensing, SmartTherm Lite (AT-2100): not supported."),
     (P, "Occupancy sensing, SmartTherm Pro (AT-3200): passive infrared (PIR) sensor."),
     (P, "Remote temperature sensors, SmartTherm Lite (AT-2100): not supported."),
     (P, "Remote temperature sensors, SmartTherm Pro (AT-3200): up to 6 SmartSensor units."),
     (P, "Display, both models: 3.5 in. colour touchscreen."),
     ],
    [("h", "3. Hardware: SmartTherm Pro (AT-3200)"),
     ("h", "3.1 Wireless communication module"),
     (P, "The AT-3200 integrates an Espressif ESP32-S3 module providing Wi-Fi and Bluetooth LE radios."),
     (P, "The module maintains a persistent TLS 1.3 connection to the Acme Cloud service."),
     (P, "Setpoint commands from the Acme Home app are received over Wi-Fi and applied within 2 seconds."),
     ("h", "3.2 Occupancy sensor"),
     (P, "The AT-3200 includes a Panasonic EKMC-series passive infrared (PIR) motion sensor."),
     (P, "Detection range: up to 5 m. Horizontal field of view: 94 degrees."),
     (P, "Occupancy state (occupied / unoccupied) is sampled every 30 seconds and reported to the"),
     (P, "scheduling engine."),
     (P, "After 20 minutes with no detected motion, the device enters Away mode and applies the"),
     (P, "eco setpoint."),
     ("h", "3.3 Temperature sensing"),
     (P, "Onboard sensor: Sensirion SHT40 digital temperature and humidity sensor, accuracy \u00b10.2 \u00b0C."),
     (P, "Remote sensing: up to 6 SmartSensor remote units, each with its own temperature sensor."),
     (P, "SmartSensor units are sold separately and communicate over a 915 MHz sub-GHz radio link."),
     (P, "Readings from all paired sensors are averaged, or weighted by occupancy when Follow Me"),
     (P, "is enabled."),
     ],
    [("h", "4. Software and processing"),
     ("h", "4.1 Auto-Schedule"),
     (P, "Auto-Schedule builds a weekly heating and cooling schedule from the user's manual adjustments."),
     (P, "Algorithm details are described in Acme engineering whitepaper AT-WP-07."),
     ("h", "4.2 Firmware"),
     (P, "Shipping firmware for the AT-3200: version 5.4.2 (as of January 2024)."),
     ("h", "4.3 Processor"),
     (P, "Application processor: ARM Cortex-M4F at 120 MHz, 1 MB flash, 256 KB SRAM."),
     ("gap", ""),
     (P, "Specifications subject to change without notice."),
     ]])

# ---------------------------------------------------------------- whitepaper
doc(os.path.join(OUT, "Acme_AutoSchedule_Engineering_Whitepaper_AT-WP-07.pdf"),
    "Auto-Schedule Engineering Whitepaper", "AT-WP-07  v2.1", [
    [("title", "Auto-Schedule: Learning Occupant Comfort Preferences"),
     ("sub", "Acme Corp. Engineering Whitepaper AT-WP-07, version 2.1, March 2024"),
     ("h", "1. Summary"),
     (P, "Auto-Schedule predicts the setpoint an occupant will want at a given time and applies it"),
     (P, "automatically, without a schedule programmed by the user."),
     (P, "Predictions come from a supervised learning model trained on manual setpoint adjustments."),
     ("h", "2. Model"),
     (P, "The model is a gradient-boosted decision tree (GBDT) regressor with 64 trees of depth 4."),
     (P, "Input features: hour of day, day of week, occupancy state, indoor and outdoor temperature."),
     (P, "The training target is the setpoint the occupant selected manually."),
     ],
    [("h", "3. Learning over time"),
     (P, "Each manual setpoint change is logged as a labelled training example."),
     (P, "The model is retrained nightly at 02:00 local time on a rolling 21-day window of examples."),
     (P, "When an occupant overrides a predicted setpoint, the override becomes a new training label."),
     (P, "Median prediction error falls from 1.8 \u00b0C in week one to 0.6 \u00b0C by week four"),
     (P, "(internal field data, 12,400 homes)."),
     ("h", "4. On-device execution"),
     (P, "Training and inference run on the thermostat's Cortex-M4F processor."),
     (P, "No occupant data leaves the device for model training."),
     (P, "Model parameters are stored in on-device flash and versioned with each retraining."),
     ],
    [("h", "5. Relationship to occupancy sensing"),
     (P, "Occupancy state from the PIR sensor is both a model feature and a gating signal:"),
     (P, "no predicted setpoint is applied while the home is unoccupied."),
     ("h", "6. Scope and limitations"),
     (P, "This whitepaper describes the algorithm as designed for firmware 5.x."),
     (P, "Field behaviour may vary with firmware version and installation."),
     ]])

# ---------------------------------------------------------------- brochure
doc(os.path.join(OUT, "Acme_SmartTherm_Pro_Brochure.pdf"),
    "SmartTherm Pro Brochure", "Marketing brochure", [
    [("title", "SmartTherm Pro"),
     ("sub", "Comfort that learns you."),
     (P, "WiFi-enabled smart thermostat connects to your home network."),
     (P, "Auto-Schedule learns your preferred temperatures."),
     (P, "Built-in motion sensor knows when you're home and when you're away."),
     (P, "Add SmartSensors to keep every room comfortable."),
     (P, "Control it from anywhere with the Acme Home app."),
     ("gap", ""),
     (P, "Available now at acme-home.example"),
     ]])

# ---------------------------------------------------------------- API reference (held back)
doc(os.path.join(OUT, "Acme_Developer_API_Reference_v3.pdf"),
    "Acme Home Developer API Reference v3", "Developer docs  v3", [
    [("title", "Acme Home Developer API: Reference v3"),
     ("sub", "developer.acme-home.example/api/v3/autoschedule    Last updated May 2024"),
     ("h", "GET /v3/devices/{device_id}/autoschedule/model"),
     (P, "Returns metadata for the Auto-Schedule model currently deployed on the device."),
     ("gap", ""),
     (P, "Example response, SmartTherm Pro (AT-3200), firmware 5.4.2:"),
     ("code", '"model_type": "gbdt_regressor",'),
     ("code", '"n_estimators": 64,'),
     ("code", '"max_depth": 4,'),
     ("code", '"training_window_days": 21,'),
     ("code", '"retrain_schedule": "daily@02:00",'),
     ("code", '"label_source": "manual_setpoint_events",'),
     ("code", '"last_trained_at": "2024-06-11T02:00:14Z",'),
     ("code", '"firmware_version": "5.4.2"'),
     ],
    [("h", "GET /v3/devices/{device_id}/autoschedule/events"),
     (P, "Returns the manual setpoint events used as training labels, newest first."),
     (P, "Each event: timestamp, previous_setpoint, new_setpoint, occupancy_state, source."),
     ("gap", ""),
     (P, "Rate limits: 60 requests per minute per API key."),
     ]])

print("pdfs written to", OUT)
