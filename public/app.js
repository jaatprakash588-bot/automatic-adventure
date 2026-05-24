document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const urlInput = document.getElementById('instagram-url');
  const pasteBtn = document.getElementById('paste-btn');
  const downloadBtn = document.getElementById('download-btn');
  
  const loader = document.getElementById('loader');
  const loaderStatus = document.getElementById('loader-status');
  const errorAlert = document.getElementById('error-alert');
  const errorMessage = document.getElementById('error-message');
  
  const resultSection = document.getElementById('result-section');
  const sourceBadge = document.getElementById('source-badge');
  const typeBadge = document.getElementById('type-badge');
  const mediaPreviewBox = document.getElementById('media-preview-box');
  const mediaCaptionText = document.getElementById('media-caption-text');
  const mediaTimestamp = document.getElementById('media-timestamp');
  const directDownloadLink = document.getElementById('direct-download-link');
  const copyLinkBtn = document.getElementById('copy-link-btn');
  
  const statTotal = document.getElementById('stat-total');
  const statVideos = document.getElementById('stat-videos');
  const statImages = document.getElementById('stat-images');
  const statDownloads = document.getElementById('stat-downloads');
  
  const mediaDownloadCount = document.getElementById('media-download-count');
  
  const historySearch = document.getElementById('history-search');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const historyGrid = document.getElementById('history-grid');
  const historyEmpty = document.getElementById('history-empty');
  
  const faqItems = document.querySelectorAll('.faq-item');

  // State Variables
  let activeFilter = 'all';
  let activeSearch = '';

  // Initial Load
  if (window.location.protocol === 'file:') {
    showError('⚠️ System Error: You have opened the "index.html" file directly from your local folders. To download videos, you MUST start the Node backend server (e.g. "npm start") and visit http://localhost:3000 in your browser address bar.');
    downloadBtn.disabled = true;
    downloadBtn.style.opacity = '0.6';
    downloadBtn.style.cursor = 'not-allowed';
  } else {
    fetchStats();
    fetchHistory();
  }

  // Clipboard Paste Helper
  pasteBtn.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        urlInput.value = text;
        urlInput.focus();
        showInputNotification('Link pasted!', 'success');
      } else {
        // Fallback for browsers that don't support async clipboard API
        showInputNotification('Clipboard access not supported. Use Ctrl+V to paste.', 'error');
      }
    } catch (err) {
      showInputNotification('Permission denied to access clipboard.', 'error');
    }
  });

  // Extract Media Request
  downloadBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      showError('Please enter an Instagram link first.');
      return;
    }

    // Basic client validation
    const isIgUrl = /instagram\.com\/(p|reel|tv|stories)/i.test(url);
    if (!isIgUrl) {
      showError('Please enter a valid Instagram URL. Example: https://www.instagram.com/reel/...');
      return;
    }

    // Reset UI State
    hideError();
    hideResult();
    showLoader('Contacting Instagram servers...');

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to extract media.');
      }

      // Hide Loader & Display Result
      hideLoader();
      displayResult(data);
      
      // Refresh History and Stats
      fetchStats();
      fetchHistory();
      
      // Smooth scroll to result
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });

    } catch (error) {
      hideLoader();
      showError(error.message);
    }
  });

  // Copy Direct Link to Clipboard
  copyLinkBtn.addEventListener('click', () => {
    const link = directDownloadLink.href;
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        const originalText = copyLinkBtn.innerHTML;
        copyLinkBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        copyLinkBtn.style.borderColor = 'var(--color-success)';
        setTimeout(() => {
          copyLinkBtn.innerHTML = originalText;
          copyLinkBtn.style.borderColor = 'var(--border-color)';
        }, 2000);
      });
    }
  });

  // Increment download count locally & refresh counters on device download click
  directDownloadLink.addEventListener('click', () => {
    const id = directDownloadLink.getAttribute('data-id');
    if (id) {
      // Locally increment the badge counter for instant feedback
      const countText = mediaDownloadCount.textContent;
      const matches = countText.match(/^(\d+)/);
      if (matches) {
        const currentCount = parseInt(matches[1], 10);
        const newCount = currentCount + 1;
        mediaDownloadCount.textContent = `${newCount} download${newCount === 1 ? '' : 's'}`;
      }
      
      // Fetch updated history and stats after a short delay for the DB write
      setTimeout(() => {
        fetchHistory();
        fetchStats();
      }, 800);
    }
  });

  // Use event delegation for download link clicks in history grid
  historyGrid.addEventListener('click', (e) => {
    const downloadIconBtn = e.target.closest('.download-btn-icon');
    if (downloadIconBtn) {
      setTimeout(() => {
        fetchHistory();
        fetchStats();
      }, 800);
    }
  });

  // History Search Event
  let searchTimeout;
  historySearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    activeSearch = e.target.value;
    searchTimeout = setTimeout(() => {
      fetchHistory();
    }, 400);
  });

  // History Filter Buttons
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeFilter = btn.getAttribute('data-filter');
      fetchHistory();
    });
  });

  // FAQ Accordion Toggle
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    
    question.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      
      // Close all items
      faqItems.forEach(i => {
        i.classList.remove('open');
        i.querySelector('.faq-answer').style.maxHeight = null;
      });

      // Toggle current item
      if (!isOpen) {
        item.classList.add('open');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // Core API Functions

  async function fetchStats() {
    try {
      const response = await fetch('/api/stats');
      const stats = await response.json();
      
      if (response.ok) {
        animateCounter(statTotal, stats.total);
        animateCounter(statVideos, stats.videos);
        animateCounter(statImages, stats.images);
        animateCounter(statDownloads, stats.downloads);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }

  async function fetchHistory() {
    try {
      const url = `/api/history?search=${encodeURIComponent(activeSearch)}&type=${activeFilter}`;
      const response = await fetch(url);
      const items = await response.json();

      if (response.ok) {
        renderHistoryGrid(items);
      }
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  }

  async function deleteHistoryItem(id) {
    if (!confirm('Are you sure you want to delete this download log from the database?')) {
      return;
    }

    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        fetchHistory();
        fetchStats();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete record.');
      }
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  }

  // UI Rendering & Manipulation Helper Functions

  function displayResult(item) {
    // 1. Source Badge (Live vs Mock)
    if (item.is_mock) {
      sourceBadge.textContent = 'Demo Content';
      sourceBadge.classList.add('demo');
    } else {
      sourceBadge.textContent = 'Live Content';
      sourceBadge.classList.remove('demo');
    }

    // 2. Type Badge
    typeBadge.textContent = item.media_type;

    // 3. Media Preview Box
    mediaPreviewBox.innerHTML = '';
    if (item.media_type === 'video') {
      const video = document.createElement('video');
      video.controls = true;
      video.playsInline = true;
      video.poster = item.thumbnail_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop';
      
      const source = document.createElement('source');
      // Stream video via proxy to resolve CORS and allow direct play
      source.src = `/api/proxy?url=${encodeURIComponent(item.media_url)}&id=${item.id}`;
      source.type = 'video/mp4';
      
      video.appendChild(source);
      mediaPreviewBox.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.src = item.media_url;
      img.alt = 'Instagram Photo';
      mediaPreviewBox.appendChild(img);
    }

    // 4. Caption & Details
    mediaCaptionText.textContent = item.caption || 'No caption available.';
    mediaTimestamp.textContent = getRelativeTime(item.created_at);

    // Set download count text
    if (mediaDownloadCount) {
      mediaDownloadCount.textContent = `${item.download_count || 0} download${(item.download_count || 0) === 1 ? '' : 's'}`;
    }

    // 5. Action Link Update (Proxy link for browser download trigger)
    directDownloadLink.href = `/api/proxy?url=${encodeURIComponent(item.media_url)}&id=${item.id}`;
    directDownloadLink.setAttribute('data-id', item.id);

    resultSection.classList.remove('hidden');
  }

  function renderHistoryGrid(items) {
    historyGrid.innerHTML = '';

    if (items.length === 0) {
      historyEmpty.classList.remove('hidden');
      return;
    }

    historyEmpty.classList.add('hidden');

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'history-card glass';

      // Determine appropriate overlay icon
      const iconClass = item.media_type === 'video' ? 'fa-clapperboard' : 'fa-image';

      card.innerHTML = `
        <div class="card-media-wrapper">
          <img src="${item.thumbnail_url || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop'}" alt="Media Thumbnail" loading="lazy">
          <div class="card-media-overlay">
            <span class="overlay-badge">${item.is_mock ? 'Demo' : 'Live'}</span>
            <span class="overlay-icon"><i class="fa-solid ${iconClass}"></i></span>
          </div>
        </div>
        <div class="card-details">
          <p class="card-caption" title="${escapeHtml(item.caption)}">${escapeHtml(item.caption || 'No caption.')}</p>
          <div class="card-meta">
            <span>${getRelativeTime(item.created_at)} • <i class="fa-solid fa-download" style="font-size:0.75rem;"></i> ${item.download_count || 0}</span>
            <div class="card-actions">
              <a href="/api/proxy?url=${encodeURIComponent(item.media_url)}&id=${item.id}" class="action-icon-btn download-btn-icon" title="Download file" download>
                <i class="fa-solid fa-download"></i>
              </a>
              <button class="action-icon-btn delete-btn" data-id="${item.id}" title="Remove log">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;

      // Set up click handler for delete button
      card.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteHistoryItem(item.id);
      });

      // Quick preview on clicking card body (except action buttons)
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.card-actions')) {
          displayResult(item);
          resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });

      historyGrid.appendChild(card);
    });
  }

  // Utility helpers

  function showLoader(message) {
    loaderStatus.textContent = message;
    loader.classList.remove('hidden');
  }

  function hideLoader() {
    loader.classList.add('hidden');
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorAlert.classList.remove('hidden');
  }

  function hideError() {
    errorAlert.classList.add('hidden');
  }

  function hideResult() {
    resultSection.classList.add('hidden');
  }

  function animateCounter(element, target) {
    const currentVal = parseInt(element.textContent, 10) || 0;
    if (currentVal === target) return;

    let start = currentVal;
    const duration = 600; // ms
    const startTime = performance.now();

    function updateCounter(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out quad formula
      const easeProgress = progress * (2 - progress);
      const value = Math.floor(start + (target - start) * easeProgress);
      
      element.textContent = value;

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        element.textContent = target;
      }
    }
    requestAnimationFrame(updateCounter);
  }

  function showInputNotification(text, type) {
    const originalText = pasteBtn.innerHTML;
    pasteBtn.innerHTML = type === 'success' 
      ? `<i class="fa-solid fa-circle-check" style="color: var(--color-success)"></i> <span>${text}</span>`
      : `<i class="fa-solid fa-circle-exclamation" style="color: var(--color-error)"></i> <span>${text}</span>`;
    
    setTimeout(() => {
      pasteBtn.innerHTML = originalText;
    }, 2000);
  }

  function getRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now - date) / 1000);
    
    if (isNaN(seconds) || seconds < 0) return 'Just now';

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60
    };

    for (const [unit, value] of Object.entries(intervals)) {
      const count = Math.floor(seconds / value);
      if (count >= 1) {
        return `${count} ${unit}${count > 1 ? 's' : ''} ago`;
      }
    }

    return 'Just now';
  }

  function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
