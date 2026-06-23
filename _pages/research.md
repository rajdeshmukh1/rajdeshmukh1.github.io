---
layout: archive
title: "Academic Research"
permalink: /research/
author_profile: true
description: "Raj Deshmukh's research in distributed state estimation over sensor networks and data-driven anomaly detection for air traffic management."
---

My research had two major foci. The first lay in the domain of <strong>distributed state estimation and control</strong> — a subset of networked systems. As sensors become cheaper, miniaturized, and computationally more powerful, the quality of estimation relies on how well the communicating sensors merge and assimilate their measurements. The second was toward deepening an <strong>understanding of the air traffic management system complexity through data-driven methods</strong>. With the advent of powerful machine learning tools in tandem with high-fidelity data recording tools in the airspace system, the study of large aviation datasets can allow us to model evolutionary behaviors in the complex air traffic management system. Upon scaling algorithms dedicated to this purpose, they can potentially be used as support tools to automate the decision-making process for air traffic control, which will help safely increase the throughput of the system. Apart from these two, I also took an avid interest in autonomous navigation capabilities associated with ground vehicles.

<hr>
How to Make Networked Sensors Smarter?
------

<figure class="imm-widget">
  <canvas id="imm-canvas" aria-hidden="true"></canvas>
  <div class="imm-widget__controls">
    <div class="imm-widget__modes" role="radiogroup" aria-label="True aircraft maneuver">
      <span class="imm-widget__lbl">True maneuver</span>
      <label><input type="radio" name="imm-mode" value="0" checked> constant velocity</label>
      <label><input type="radio" name="imm-mode" value="1"> left turn</label>
      <label><input type="radio" name="imm-mode" value="2"> right turn</label>
    </div>
    <label class="imm-widget__noise">sensors <input type="range" id="imm-count" min="2" max="8" step="1" value="5" aria-label="Number of sensors"></label>
    <label class="imm-widget__noise">radar noise <input type="range" id="imm-noise" min="2" max="20" step="0.5" value="7" aria-label="Radar measurement noise"></label>
  </div>
  <div class="imm-widget__chips" id="imm-chips" role="group" aria-label="Blind a sensor — it keeps tracking via the network"></div>
  <figcaption>The heart of my distributed state estimation research, made interactive: several noisy radars each track the same maneuvering aircraft with their own <strong>Interacting Multiple Model</strong> filter, then reach <strong>consensus</strong> over a communication network. Each radar keeps its <strong>own</strong> estimate — its local filter plus a consensus nudge from neighbours, not a central fuser; the bold mahogany line is <strong>Sensor&nbsp;1's</strong>, the faint ones the other sensors'. The error bars (top&#8209;left) compare Sensor&nbsp;1 <em>alone</em> vs <em>networked</em> — folding in neighbours' information tightens it. <strong>Blind a sensor</strong> — click a node or a chip below — and it keeps tracking on communication alone: a naïve node. Shift-click any sensor to <strong>sever its network links</strong> — a blind one then drifts, while a sighted one falls back to a lone standalone filter (no fusion). The mode bars show the network agreeing on the maneuver.</figcaption>
</figure>

 <div id="dots" class="research-prose" style="display:block"><p>The general idea of estimation is to derive the 'best estimate' for the true value of the state of some system from an incomplete, potentially noisy set of observations on that system. Distributed estimation extends this idea to obtain a state estimate using a network of communication-capable sensors, where the sensors can now correct each others' estimates and achieve overall improvement. My research in this area focused on deriving 'optimal' target state estimates, applicable to both linear and hybrid state evolutions.</p></div>
 <div id="more" class="research-prose" style="display:none"><p>The general idea of estimation is to derive the 'best estimate' for the true value of the state of some system from an incomplete, potentially noisy set of observations on that system. Distributed estimation extends this idea to obtain a state estimate using a network of communication-capable sensors, where the sensors can now correct each others' estimates and achieve overall improvement.</p><p>In a founding consensus-based distributed estimation <a href="https://ieeexplore.ieee.org/abstract/document/5399678">article</a>, Olfati introduced a novel consensus-based update architecture for distributed estimation, albeit developing a sub-optimal version owing to the mathematical and implementational complexity involved in developing an optimal version.</p><p>I devoted my time to research an <a href="https://ieeexplore.ieee.org/abstract/document/7963859" title="Optimal discrete-time Kalman consensus filter @ ACC2017">optimal form</a> of this Kalman consensus filter (OKCF), where the optimal gains resulted in the best possible MMSE estimate of the target. To improve the applicability of the optimal distributed estimator, I subsequently worked to enhance the algorithm to estimate the <a href="https://digital-library.theiet.org/content/journals/10.1049/iet-cta.2017.1208" title="Distributed State Estimation for a Stochastic Linear Hybrid System over a Sensor Network @ IET">hybrid states</a> of target evolving in a hybrid fashion using the Interacting Multiple Model concept.</p>

 <figure>
  <img src="/images/iet1.png" alt="Distributed Hybrid State Estimator" style="width:50%">
  <figcaption>Architecture of distributed hybrid estimator.</figcaption>
</figure>

<div class="flex-container">
  <div><figure>
  <img src="/images/iet2.jpg" alt="Tracked aircraft trajectory" style="width:50%">
  <figcaption>Tracking an aircraft that switches between left-turn, right-turn and constant-velocity modes, using a network of air-traffic surveillance sensors.</figcaption>
</figure></div>
  <div><figure>
  <img src="/images/iet3.jpg" alt="Aircraft mode porbability" style="width:50%">
  <figcaption>Estimated mode probabaility.</figcaption>
</figure></div>
</div> 
 
<p>During the end of my Ph.D., I was involved in an investigation to modify the algorithm to allow the sensors to be '<a href="https://ieeexplore.ieee.org/abstract/document/9030070" title="Optimal Kalman Consensus Filter for Weighted Directed Graphs @ CDC2019">naïve</a>', in the sense that some sensors may not be able to obtain measurements from the target, but are relying just on communicated information.</p></div>
<hr style="height:1pt; visibility:hidden;" />
<btn onclick="myFunction1()" id="myBtn">Read more +</btn> 

<hr>
Toward Automating Air Traffic Management
------

<figure class="atc-widget">
  <canvas id="atc-canvas" aria-hidden="true"></canvas>
  <div class="atc-widget__controls" role="radiogroup" aria-label="Arrival scenario">
    <span class="atc-widget__lbl">Arrival</span>
    <label><input type="radio" name="atc" value="0" checked> nominal</label>
    <label><input type="radio" name="atc" value="1"> early descent</label>
    <label><input type="radio" name="atc" value="2"> lateral drift</label>
    <label><input type="radio" name="atc" value="3"> high &amp; fast</label>
    <label><input type="radio" name="atc" value="4"> go-around</label>
  </div>
  <p class="atc-widget__verdict" id="atc-verdict"></p>
  <input type="range" id="atc-scrub" class="atc-widget__scrub" min="0" max="1000" value="0" step="1" aria-label="Scrub the approach timeline">
  <figcaption>A toy representation of my Ph.D. work, over a real map of the <strong>LGA terminal area</strong>: an arrival on RWY&nbsp;31 final, checked against <strong>human-interpretable bounds</strong> learned from nominal traffic (a lateral corridor + an altitude band, inset). Pick a maneuver — the monitor first raises an amber <strong>precursor</strong> warning (a learned indicator from multi-aircraft and -airport states) a few seconds <em>before</em> the red <strong>anomaly</strong>.</figcaption>
</figure>

<div id="dot2" class="research-prose" style="display:block"><p>Providing intelligent algorithms to manage the ever-increasing demand of air traffic and airspace congestion is critical to the efficiency and economic viability of air transportation systems. My research in the air traffic management domain involved applying machine learning tools to detect anomalous behvior (through unsupervised learning) and subsequently detect their precursors (through supervised learning). The algorithms were deployed on a testbed, and demonstrated as an online anomaly monitoring and mitigation tools for real air-traffic surveillance data from the terminal airspace operations of the New York metroplex.</p>
</div>

<div id="mor2" class="research-prose" style="display:none"><p>Providing intelligent algorithms to manage the ever-increasing demand of air traffic and airspace congestion is critical to the efficiency and economic viability of air transportation systems. During my masters program, I undertook research in this domain for a project titled 'Intent-Based Data Mining for Identifying and Classifying Conflict Detection and Resolution from Historical Aircraft Track Data', which coupled together the concepts of machine learning and air traffic management. The project involved applying machine learning techniques to find patterns in trajectory-based operations, and mimic the responses of air traffic controllers and pilots to en-route conflicts.</p>

<p>Initially starting with off-the-shelf toolboxes to analyze the aviation datasets, we realized that basic toolboxes like Support Vector Machines and Neural Networks were incapable of learning the intricacies and variabilities of human responses in this context. Therefore, we developed a novel feature-weighted approach to learning, which improved the performance of the supervised learning process. This project exposed me to the inherent challenges of implementing mathematical techniques to such practical systems and motivated me to delve deeper into this field.</p>

<p>During my Ph.D., I researched anomaly detection in aviation datasets, where the anomalies are closely tied to operational or safety issues in the terminal airspace. Inspired by the <a href="https://drive.google.com/file/d/1id_UXBjm1BgBnSL_35I2NbHAuUlSmAsR/view">work</a> of a colleague, I developed a human-interpretable anomaly detection algorithm — called <a href="https://arc.aiaa.org/doi/abs/10.2514/6.2019-0682" title="Anomaly Detection Using Temporal Logic Based Learning for Terminal Airspace Operations @ SciTech 2019">TempAD</a> — relying on unsupervised machine learning techniques to aid the visualization of anomaly detection models in the physical space. Considering that aviation operations are periodic, I developed a recursive data-driven anomaly detection algorithm — called <a href="https://arc.aiaa.org/doi/10.2514/1.I010711" title="Incremental-Learning-Based Unsupervised Anomaly Detection Algorithm for Terminal Airspace Operations @ JAIS">TempAD-OU</a> (for Overnight Update) — that was capable of maintaining an anomaly detection model library and incrementally adapting it to newly recorded data.</p><p>This research focused on finding abnormal behavior in the terminal airspace; a complementary problem and a natural next-step is prognosis, i.e., determining the causes — called precursors — for these behaviors in the same dataset. For this purpose, I developed a precursor detection algorithm — called <a href="https://arc.aiaa.org/doi/10.2514/1.D0182" title="Reactive Temporal Logic-Based Precursor Detection Algorithm for Terminal Airspace Operations @ JAT">reactive TempAD</a> — through a supervised learning approach.</p><p>Toward the end of my Ph.D., I worked on enhancing these algorithms to apply to real-time streaming data, so that they could potentially be used as online anomaly monitoring and mitigation tools.</p>

<figure>
  <img src="/images/tempad1.png" alt="Architecture of Anomaly Detection Algorithm" style="width:70%">
  <figcaption>Architecture of anomaly detection algorithm.</figcaption>
</figure>

<figure>
  <img src="/images/NewerSturn.png" alt="Anomaly and Precursor Detection" style="width:50%">
  <figcaption>Anomaly and precursor detection for approach to LGA RWY31.</figcaption>
</figure>

<p>This research for anomaly and precursor detection was a collaborative project with NASA, Mosaic ATM, and Honeywell, and required me to test and then package and deploy the developed algorithms. The algorithms were tested in a realistic scenario on datasets recorded in the New York metroplex airspace region.</p>
<hr style="height:1pt; visibility:hidden;" />
<!-- video removed
<iframe width="420" height="315"
src="/images/tempad2.mp4">
</iframe>
-->
</div>
<hr style="height:1pt; visibility:hidden;" />
<btn onclick="myFunction2()" id="myBt2">Read more +</btn> 

<hr>
Balanced Strategies for Autonomous Navigation
------
As part of class coursework, I worked on a project aimed at the development of new strategies to aid navigation of autonomous ground vehicles. The project investigated the dynamically evolving balance between performance and safety of vehicles, characterized by a 'likelihood of collision' metric embedded within a dynamic programming framework. With the advent of autonomous vehicles and the increasing rate of research being done into networking such autonomous systems, this project piqued my interest and compelled me to learn more about this field.

<script>
function myFunction1() {
  var dots = document.getElementById("dots");
  var moreText = document.getElementById("more");
  var btnText = document.getElementById("myBtn");

  if (dots.style.display === "none") {
    dots.style.display = "block";
    btnText.innerHTML = "Read more +"; 
    moreText.style.display = "none";
  } else {
    dots.style.display = "none";
    btnText.innerHTML = "Read less -"; 
    moreText.style.display = "block";
  }
}

function myFunction2() {
  var dots2 = document.getElementById("dot2");
  var moreText2 = document.getElementById("mor2");
  var btnText2 = document.getElementById("myBt2");

  if (dots2.style.display === "none") {
    dots2.style.display = "block";
    btnText2.innerHTML = "Read more +"; 
    moreText2.style.display = "none";
  } else {
    dots2.style.display = "none";
    btnText2.innerHTML = "Read less -"; 
    moreText2.style.display = "block";
  }
}
</script>

{% include base_path %}
