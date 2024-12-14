---
layout: archive
title: "Research"
permalink: /research/
author_profile: true
---

My research has two major foci. The first focus lies in the domain of <strong>distributed state estimation and control</strong> — a subset of networked systems. As sensors become cheaper, miniaturized, and computationally more powerful, the quality of estimation relies on how well the communicating sensors merge and assimilate their measurements. The second focus is toward deepening an <strong>understanding of the air traffic management system complexity through data-driven methods</strong>. With the advent of powerful machine learning tools in tandem with high-fidelity data recording tools in the airspace system, the study of large aviation datasets can allow us to model evolutionary behaviors in the complex air traffic management system. Upon scaling algorithms dedicated to this purpose, they can potentially be used as support tools to automate the decision-making process for air traffic control, which will help safely increase the throughput of the system. Apart from these two, I have taken an avid interest in autonomous navigation capabilities associated with ground vehicles.

<hr>
How to Make Networked Sensors Smarter?
------
 <div id="dots" style="display:inline">The general idea of estimation is to derive the 'best estimate' for the true value of the state of some system from an incomplete, potentially noisy set of observations on that system. Distributed estimation extends this idea to obtain a state estimate using a network of communication-capable sensors, where the sensors can now correct each others' estimates and achieve overall improvement. My research in this area focuses on deriving 'optimal' target state estimates, applicable to both linear and hybrid state evolutions.</div>
 <div id="more" style="display:none">The general idea of estimation is to derive the 'best estimate' for the true value of the state of some system from an incomplete, potentially noisy set of observations on that system. Distributed estimation extends this idea to obtain a state estimate using a network of communication-capable sensors, where the sensors can now correct each others' estimates and achieve overall improvement. In a founding consensus-based distributed estimation <a href="https://ieeexplore.ieee.org/abstract/document/5399678">article</a>, Olfati introduced a novel consensus-based update architecture for distributed estimation, albeit developing a sub-optimal version owing to the mathematical and implementational complexity involved in developing an optimal version. I devoted my time to research an <a href="https://ieeexplore.ieee.org/abstract/document/7963859" title="Optimal discrete-time Kalman consensus filter @ ACC2017">optimal form</a> of this Kalman consensus filter (OKCF), where the optimal gains resulted in the best possible MMSE estimate of the target. To improve the applicability of the optimal distributed estimator, I subsequently worked to enhance the algorithm to estimate the <a href="https://digital-library.theiet.org/content/journals/10.1049/iet-cta.2017.1208" title="Distributed State Estimation for a Stochastic Linear Hybrid System over a Sensor Network @ IET">hybrid states</a> of target evolving in a hybrid fashion using the Interacting Multiple Model concept.

 <figure>
  <img src="/images/iet1.png" alt="Distributed Hybrid State Estimator" style="width:40%">
  <figcaption>Architecture of distributed hybrid estimator.</figcaption>
</figure>

<div class="flex-container">
  <div><figure>
  <img src="/images/iet2.jpg" alt="Tracked aircraft trajectory" style="width:80%">
  <figcaption>Tracking an aircraft that switches between left-turn, right-turn and constant-velocity modes, using a network of air-traffic surveillance sensors.</figcaption>
</figure></div>
  <div><figure>
  <img src="/images/iet3.jpg" alt="Aircraft mode porbability" style="width:80%">
  <figcaption>Estimated mode probabaility.</figcaption>
</figure></div>
</div> 
 
During recent months, I have been involved in an investigation to modify the algorithm to allow the sensors to be '<a href="https://ieeexplore.ieee.org/abstract/document/9030070" title="Optimal Kalman Consensus Filter for Weighted Directed Graphs @ CDC2019">naïve</a>', in the sense that some sensors may not be able to obtain measurements from the target, but are relying just on communicated information.</div>
<hr style="height:1pt; visibility:hidden;" />
<btn onclick="myFunction1()" id="myBtn">Read more +</btn> 

<hr>
Toward Automating Air Traffic Management
------
<div id="dot2" style="display:inline"> Providing intelligent algorithms to manage the ever-increasing demand of air traffic and airspace congestion is critical to the efficiency and economic viability of air transportation systems. My research in the air traffic management domain involved applying machine learning tools to detect anomalous behvior (through unsupervised learning) and subsequently detect their precursors (through supervised learning). The algorithms were deployed on a testbed, and demonstrated as an online anomaly monitoring and mitigation tools for real air-traffic surveillance data from the terminal airspace operations of the New York metroplex.
</div>

<div id="mor2" style="display:none"> Providing intelligent algorithms to manage the ever-increasing demand of air traffic and airspace congestion is critical to the efficiency and economic viability of air transportation systems. During my masters program, I undertook research in this domain for a project titled 'Intent-Based Data Mining for Identifying and Classifying Conflict Detection and Resolution from Historical Aircraft Track Data', which coupled together the concepts of machine learning and air traffic management. The project involved applying machine learning techniques to find patterns in trajectory-based operations, and mimic the responses of air traffic controllers and pilots to en-route conflicts. Initially starting with off-the-shelf toolboxes to analyze the aviation datasets, we realized that basic toolboxes like Support Vector Machines and Neural Networks were incapable of learning the intricacies and variabilities of human responses in this context. Therefore, we developed a novel feature-weighted approach to learning, which improved the performance of the supervised learning process. This project exposed me to the inherent challenges of implementing mathematical techniques to such practical systems and motivated me to delve deeper into this field.
<br>

During my Ph.D., I researched anomaly detection in aviation datasets, where the anomalies are closely tied to operational or safety issues in the terminal airspace. Inspired by the <a href="http://icrat.org/ICRAT/seminarContent/2018/papers/ICRAT_2018_paper_39.pdf">work</a> of a colleague, I developed a human-interpretable anomaly detection algorithm — called <a href="https://arc.aiaa.org/doi/abs/10.2514/6.2019-0682" title="Anomaly Detection Using Temporal Logic Based Learning for Terminal Airspace Operations @ SciTech 2019">TempAD</a> — relying on unsupervised machine learning techniques to aid the visualization of anomaly detection models in the physical space. Considering that aviation operations are periodic, I developed a recursive data-driven anomaly detection algorithm — called <a href="https://arc.aiaa.org/doi/10.2514/1.I010711" title="Incremental-Learning-Based Unsupervised Anomaly Detection Algorithm for Terminal Airspace Operations @ JAIS">TempAD-OU</a> (for Overnight Update) — that was capable of maintaining an anomaly detection model library and incrementally adapting it to newly recorded data. This research focused on finding abnormal behavior in the terminal airspace; a complementary problem and a natural next-step is prognosis, i.e., determining the causes — called precursors — for these behaviors in the same dataset. For this purpose, I developed a precursor detection algorithm — called <a href="https://arc.aiaa.org/doi/10.2514/1.D0182" title="Reactive Temporal Logic-Based Precursor Detection Algorithm for Terminal Airspace Operations @ JAT">reactive TempAD</a> — through a supervised learning approach. During recent months, I have been focusing on enhancing these algorithms to be applied to real-time streaming data, so that they can potentially be used as online anomaly monitoring and mitigation tools.

<figure>
  <img src="/images/tempad1.png" alt="Architecture of Anomaly Detection Algorithm" style="width:70%">
  <figcaption>Architecture of anomaly detection algorithm.</figcaption>
</figure>

<figure>
  <img src="/images/NewerSturn.png" alt="Anomaly and Precursor Detection" style="width:50%">
  <figcaption>Anomaly and precursor detection for approach to LGA RWY31.</figcaption>
</figure>

This research for anomaly and precursor detection was a collaborative project with NASA, Mosaic ATM, and Honeywell, and required me to test and then package and deploy the developed algorithms. The algorithms were tested in a realistic scenario on datasets recorded in the New York metroplex airspace region.
<hr style="height:1pt; visibility:hidden;" />
<iframe width="420" height="315"
src="/images/tempad2.mp4">
</iframe></div>
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
    dots.style.display = "inline";
    btnText.innerHTML = "Read more +"; 
    moreText.style.display = "none";
  } else {
    dots.style.display = "none";
    btnText.innerHTML = "Read less -"; 
    moreText.style.display = "inline";
  }
}

function myFunction2() {
  var dots2 = document.getElementById("dot2");
  var moreText2 = document.getElementById("mor2");
  var btnText2 = document.getElementById("myBt2");

  if (dots2.style.display === "none") {
    dots2.style.display = "inline";
    btnText2.innerHTML = "Read more +"; 
    moreText2.style.display = "none";
  } else {
    dots2.style.display = "none";
    btnText2.innerHTML = "Read less -"; 
    moreText2.style.display = "inline";
  }
}
</script>

{% include base_path %}
