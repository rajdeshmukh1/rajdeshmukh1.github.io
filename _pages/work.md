---
layout: archive
title: "Work Experience"
permalink: /work/
author_profile: true
description: "Raj Deshmukh's industry work on multi-modal lane perception and tracking at PlusAI and multi-sensor object fusion at Aptiv for autonomous driving."
---

My industry work has centered on two halves of an autonomous vehicle's perception stack — **lane perception** and **object fusion**.

<figure class="lane-widget">
  <canvas id="lane-canvas" aria-hidden="true"></canvas>
  <div class="lane-widget__controls">
    <div class="lane-widget__modes" role="radiogroup" aria-label="Perception mode">
      <label><input type="radio" name="lane-mode" value="lane" checked> lane perception</label>
      <label><input type="radio" name="lane-mode" value="object"> object fusion</label>
    </div>
    <label class="lane-widget__noise">sensor noise <input type="range" id="lane-noise" min="0.3" max="3" step="0.1" value="1" aria-label="Sensor noise"></label>
    <span class="lane-widget__btns" id="lane-btns"></span>
  </div>
  <figcaption>One scene, two geometrically&#8209;consistent views — a <strong>forward camera</strong> (what the sensor sees) and a <strong>bird's&#8209;eye</strong> — from one shared world model. <strong>Lane perception and tracking</strong> (PlusAI): noisy lane&#8209;marking detections, with dashed gaps and a passing truck's occlusion, drive a Kalman filter on the lane's <em>clothoid</em> geometry [offset, heading, curvature, curvature&#8209;rate] with the exact ego&#8209;motion propagation — the mahogany lane coasts smoothly through the gaps (1σ band widening when markings vanish). <strong>Object fusion</strong> (Aptiv): a <span style="color:#6aa8d6">radar</span> (good range, poor lateral) and a <span style="color:#c9bd6a">camera</span> (good lateral, poor range) are fused into one track tighter than either alone — drop a sensor and watch the estimate widen along its blind axis.</figcaption>
</figure>

<hr>
PlusAI — Lane Perception &amp; Tracking
------

I have been at PlusAI since November 2024 as a Scene Understanding Software Engineer under the umbrella of the perception team at Santa Clara, California. My primary responsibility involves researching and executing software solutions that enable multi-modal, multi-view end-to-end lane tracking models depending on camera, radar, and lidar sensing setups. This often involves a deep-dive into novel algorithms that tackle long-tail of real-world problems in challenging and diverse scenarios to safely enable L4 autonomous driving.

Effective sensor-agnostic lane perception which relies on deep learning techniques enables unparalleled scalability across diverse driving scenarios, thereby supporting PlusAI's <a href="https://plus.ai/solutions/superdrive" title="SuperDrive">driverless</a> systems being tested across the world.

<img src="/images/plusplayl4.gif" alt="Lane Detection and Tracking." class="center">

<hr>
Aptiv — Multi-Sensor Object Fusion
------

Prior to my start at PlusAI, I was at Aptiv as an Object Tracking Developer at Troy, Michigan. My technical contributions there involved crafting software solutions that facilitate downstream threat assessment algorithms, ensuring dependable multi-modal sensor fusion.

Sensor fusion is the ability to amalgamate inputs from several radars, lidars, and cameras into a unified model or image of the surrounding environment for a vehicle. This resultant model attains heightened accuracy by leveraging the individual strengths of each sensor modality. The insights derived from sensor fusion are harnessed by vehicle systems to drive intelligent automated or semi-automated actions. In the same vein, my role entails the design and execution of multi-target tracking algorithms, drawing inputs from numerous cameras and radars. Broadly speaking, the outcome of object tracking furnishes the host vehicle with comprehensive environmental awareness, encompassing details such as the states and classes of neighboring vehicles, pedestrians, and barriers.

This outcome is subsequently employed to bolster intelligent active driver assistance systems, such as adaptive cruise control, automatic lane-change, pre-collision warning and braking, among others. These advancements aim to reduce driver involvement and pave the way toward greater autonomy.

<img src="/images/aptiv-solution.jpg" alt="Automotive Sensing and Perception." class="center">

{% include base_path %}
