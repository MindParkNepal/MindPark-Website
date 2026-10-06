(() => {
  if (window.lucide) window.lucide.createIcons();
  const root = document.getElementById('mindpark-site');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!motionPreference.matches && 'IntersectionObserver' in window) {
    const targets = root.querySelectorAll('section h1, section h2, section .eyebrow, section p.canva-text, section article:not(.testimonial-item), .canva-image, .hero-video-space, .original-phone-area, .original-testimonials, .journey-download, .hero-bg .store-buttons, #contact > div');
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('motion-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {threshold:0.08, rootMargin:'0px 0px -24px 0px'});
    targets.forEach(element => {
      // Animate each card or group as one piece rather than layering entrances.
      if (element.parentElement.closest('article, .journey-download, #contact > div')) return;
      let type = 'rise';
      if (element.matches('.canva-image')) type = element.matches('[data-template-id="final-family-visual"]') ? 'right' : 'left';
      if (element.matches('.original-phone-area, .hero-video-space')) type = 'pop';
      element.dataset.motion = type;
      const siblings = [...element.parentElement.children];
      element.style.setProperty('--motion-delay', `${Math.min(siblings.indexOf(element),3)*100}ms`);
      revealObserver.observe(element);
    });
    root.classList.add('motion-ready');
    root.addEventListener('focusin', event => {
      const target = event.target.closest('[data-motion]');
      if (target) target.classList.add('motion-visible');
    });
    motionPreference.addEventListener('change', event => {
      if (event.matches) {
        revealObserver.disconnect();
        root.classList.remove('motion-ready');
      }
    });
  }
  const badgeObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-visible', entry.isIntersecting));
  });
  root.querySelectorAll('.store-badge').forEach(badge => badgeObserver.observe(badge));
  const dots = [...root.querySelectorAll('[data-slide]')];
  const track = root.querySelector('.phone-track');
  const phone = root.querySelector('.phone-viewport');
  const cards = [...root.querySelectorAll('.testimonial-item')];
  const reviewTrack = root.querySelector('.testimonial-track');
  let slide = 0;
  let review = 0;
  function showSlide(index) {
    slide = ((Number(index)||0) + dots.length) % dots.length;
    track.style.transform = `translateX(-${slide * 223}px)`;
    dots.forEach((dot,i) => dot.setAttribute('aria-pressed', String(i === slide)));
    [...track.children].forEach((img,i)=>img.setAttribute('aria-hidden',String(i!==slide)));
    root.querySelector('[data-slide-status]').textContent = `App screenshot ${slide + 1} of ${dots.length}`;
  }
  function showReviews(index) {
    const size = cards[0].getBoundingClientRect().width;
    const visible = Math.max(1,Math.round((reviewTrack.getBoundingClientRect().width+24)/(size+24)));
    const maximum = Math.max(0,cards.length-visible);
    review = ((Number(index)||0) + maximum + 1) % (maximum+1);
    reviewTrack.style.transform = `translateX(-${review*(size+24)}px)`;
    cards.forEach((card,i)=>{
      card.classList.toggle('is-center',i===review+Math.floor(visible/2));
      card.setAttribute('aria-hidden',String(i<review||i>=review+visible));
    });
    root.querySelector('[data-testimonial-status]').textContent=`Testimonials ${review+1} to ${Math.min(cards.length,review+visible)} of ${cards.length}`;
  }
  dots.forEach((dot,i)=>{
    dot.addEventListener('click',()=>showSlide(i));
    dot.addEventListener('keydown',e=>{
      if(['ArrowDown','ArrowRight','ArrowUp','ArrowLeft'].includes(e.key)){
        e.preventDefault();showSlide(slide+(['ArrowDown','ArrowRight'].includes(e.key)?1:-1));dots[slide].focus();
      }
    });
  });
  let downX = null;
  phone.addEventListener('pointerdown',e=>{downX=e.clientX;phone.setPointerCapture(e.pointerId);});
  phone.addEventListener('pointerup',e=>{if(downX!==null && Math.abs(e.clientX-downX)>30)showSlide(slide+(e.clientX<downX?1:-1));downX=null;});
  phone.addEventListener('pointercancel',()=>{downX=null;});
  function autoAdvance(element, advance, delay, pauseOnInteraction = true) {
    let visible = false;
    let hovered = false;
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
    }, {threshold: 0}).observe(element);
    element.addEventListener('mouseenter', () => { hovered = true; });
    element.addEventListener('mouseleave', () => { hovered = false; });
    setInterval(() => {
      const interacting = pauseOnInteraction && (hovered || element.contains(document.activeElement));
      if (visible && !document.hidden && !interacting) advance();
    }, delay);
  }
  // Keep cycling even when the pointer rests over the phone or a dot stays focused.
  autoAdvance(root.querySelector('.original-phone-area'), () => showSlide(slide + 1), 3000, false);
  autoAdvance(root.querySelector('.original-testimonials'), () => showReviews(review + 1), 6000);

  const video = root.querySelector('.hero-video');
  let videoVisible = false;
  function updateVideo() {
    if (videoVisible && !document.hidden) {
      // Autoplay is muted for browser compatibility; native controls allow sound.
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }
  new IntersectionObserver(entries => {
    videoVisible = entries[0].isIntersecting;
    updateVideo();
  }, {threshold: 0.1}).observe(video);
  document.addEventListener('visibilitychange', updateVideo);
  const menuButton=root.querySelector('#menu-button');
  const menu=root.querySelector('#mobile-menu');
  menuButton.addEventListener('click',()=>{const open=menu.classList.toggle('hidden')===false;menuButton.setAttribute('aria-expanded',String(open));});
  menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{menu.classList.add('hidden');menuButton.setAttribute('aria-expanded','false');}));
  const downloadPrompt = root.querySelector('#download-prompt');
  const promptSessionKey = 'mindpark-download-prompt-shown';
  let promptShown = false;
  try { promptShown = sessionStorage.getItem(promptSessionKey) === '1'; } catch {}
  let promptDelayPassed = false;
  function openDownloadPrompt() {
    if (downloadPrompt.open) return;
    promptShown = true;
    try { sessionStorage.setItem(promptSessionKey, '1'); } catch {}
    downloadPrompt.showModal();
    document.documentElement.classList.add('download-prompt-open');
  }
  function maybeShowDownloadPrompt() {
    const typing = document.activeElement.matches('input,textarea,select,[contenteditable="true"]');
    if (promptDelayPassed && !promptShown && !document.hidden && !typing) openDownloadPrompt();
  }
  setTimeout(() => { promptDelayPassed = true; maybeShowDownloadPrompt(); }, 7000);
  document.addEventListener('visibilitychange', maybeShowDownloadPrompt);
  root.querySelectorAll('[data-download]').forEach(button => button.addEventListener('click', openDownloadPrompt));
  downloadPrompt.querySelectorAll('.download-prompt-close,.download-prompt-later').forEach(button => button.addEventListener('click', () => downloadPrompt.close()));
  downloadPrompt.addEventListener('click', event => {
    const rect = downloadPrompt.getBoundingClientRect();
    if (event.target === downloadPrompt && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) downloadPrompt.close();
  });
  downloadPrompt.addEventListener('close', () => document.documentElement.classList.remove('download-prompt-open'));
  showSlide(0);
  showReviews(0);
  new ResizeObserver(()=>showReviews(review)).observe(reviewTrack);
})();
