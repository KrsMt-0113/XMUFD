(function() {
  'use strict';

  console.log('[XMU Downloader Inline] Content script loaded!');
  console.log('[XMU Downloader Inline] Current URL:', window.location.href);

  let filesData = [];
  let panel = null;

  // 创建下载面板UI
  function createDownloadPanel() {
    if (panel) {
      return panel;
    }

    const panelHTML = `
      <div id="xmu-downloader-panel">
        <div id="xmu-downloader-header">
          <div id="xmu-downloader-title">
            <span>XMUFD</span>
          </div>
          <div id="xmu-downloader-controls">
            <button id="xmu-minimize-btn" title="最小化">−</button>
            <button id="xmu-close-btn" title="关闭">×</button>
          </div>
        </div>
        <div id="xmu-downloader-content">
          <div id="xmu-downloader-status">正在检测文件...</div>
          <div id="xmu-files-container"></div>
        </div>
      </div>
    `;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = panelHTML;
    panel = tempDiv.firstElementChild;

    document.body.appendChild(panel);

    // 添加拖拽功能
    makeDraggable(panel);

    // 添加控制按钮事件
    const minimizeBtn = panel.querySelector('#xmu-minimize-btn');
    const closeBtn = panel.querySelector('#xmu-close-btn');

    minimizeBtn.addEventListener('click', () => {
      panel.classList.toggle('minimized');
      minimizeBtn.textContent = panel.classList.contains('minimized') ? '+' : '−';
    });

    closeBtn.addEventListener('click', () => {
      panel.style.display = 'none';
    });

    console.log('[XMU Downloader Inline] Panel created');
    return panel;
  }

  // 使面板可拖拽
  function makeDraggable(element) {
    const header = element.querySelector('#xmu-downloader-header');
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
      e.preventDefault();
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.onmouseup = closeDragElement;
      document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
      e.preventDefault();
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.right = "auto";
    }

    function closeDragElement() {
      document.onmouseup = null;
      document.onmousemove = null;
    }
  }

  // 更新文件列表显示
  function updateFilesList(files) {
    filesData = files;

    if (!panel) {
      createDownloadPanel();
    }

    panel.style.display = 'block';

    const statusDiv = panel.querySelector('#xmu-downloader-status');
    const container = panel.querySelector('#xmu-files-container');

    if (!files || files.length === 0) {
      statusDiv.textContent = '当前页面没有检测到文件';
      statusDiv.className = '';
      container.innerHTML = `
        <div class="xmu-empty-state">
          <div class="xmu-empty-icon">📭</div>
          <div class="xmu-empty-text">
            请导航到包含文件的活动页面<br>
            文件检测到后会自动显示
          </div>
        </div>
      `;
      return;
    }

    statusDiv.textContent = `检测到 ${files.length} 个文件`;
    statusDiv.className = 'success';

    let html = '';
    files.forEach((file, index) => {
      html += `
        <div class="xmu-file-item" data-index="${index}">
          <div class="xmu-file-info">
            <div class="xmu-file-name" title="${escapeHtml(file.name)}">
              ${escapeHtml(file.name)}
            </div>
            <div class="xmu-file-id">ID: ${file.id}</div>
          </div>
          <button class="xmu-download-btn" data-file-id="${file.id}" data-file-name="${escapeHtml(file.name)}">
            下载
          </button>
        </div>
      `;
    });

    if (files.length > 1) {
      html += `
        <button class="xmu-download-all-btn" id="xmu-download-all">
          下载全部 (${files.length} 个文件)
        </button>
      `;
    }

    container.innerHTML = html;

    // 添加下载按钮事件
    container.querySelectorAll('.xmu-download-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const fileId = this.getAttribute('data-file-id');
        const fileName = this.getAttribute('data-file-name');
        downloadFile(fileId, fileName, this);
      });
    });

    // 添加下载全部按钮事件
    const downloadAllBtn = container.querySelector('#xmu-download-all');
    if (downloadAllBtn) {
      downloadAllBtn.addEventListener('click', function() {
        downloadAllFiles(this);
      });
    }

    console.log('[XMU Downloader Inline] Files list updated:', files.length);
  }

  // 下载单个文件
  function downloadFile(fileId, fileName, button) {
    console.log('[XMU Downloader Inline] Downloading:', fileName);

    button.disabled = true;
    button.textContent = '下载中...';

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      fileId: fileId,
      fileName: fileName
    }, response => {
      if (chrome.runtime.lastError) {
        console.error('[XMU Downloader Inline] Download error:', chrome.runtime.lastError);
        button.textContent = '失败';
        setTimeout(() => {
          button.textContent = '重试';
          button.disabled = false;
        }, 2000);
      } else if (response && response.success) {
        console.log('[XMU Downloader Inline] Download success');
        button.textContent = '✓ 完成';
        setTimeout(() => {
          button.textContent = '下载';
          button.disabled = false;
        }, 2000);
      } else {
        console.error('[XMU Downloader Inline] Download failed:', response);
        button.textContent = '失败';
        setTimeout(() => {
          button.textContent = '重试';
          button.disabled = false;
        }, 2000);
      }
    });
  }

  // 下载全部文件
  function downloadAllFiles(button) {
    console.log('[XMU Downloader Inline] Downloading all files:', filesData.length);

    button.disabled = true;
    const originalText = button.textContent;

    let completed = 0;
    const total = filesData.length;

    filesData.forEach((file, index) => {
      setTimeout(() => {
        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_FILE',
          fileId: file.id,
          fileName: file.name
        }, response => {
          completed++;
          button.textContent = `下载中... (${completed}/${total})`;

          if (completed === total) {
            button.textContent = '✓ 全部完成';
            setTimeout(() => {
              button.textContent = originalText;
              button.disabled = false;
            }, 3000);
          }
        });
      }, index * 500); // 每个文件间隔500ms
    });
  }

  // HTML转义
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 拦截 fetch 请求
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];

    if (typeof url === 'string' && url.includes('/api/')) {
      console.log('[XMU Downloader Inline] Fetch API request:', url);
    }

    const response = await originalFetch.apply(this, args);

    if (typeof url === 'string') {
      const isUploadRef = url.includes('upload_reference') || url.includes('upload-reference');
      const isActivities = url.includes('/api/activities/');
      const hasReference = url.includes('reference');

      if ((isActivities && isUploadRef) || (isActivities && hasReference)) {
        console.log('[XMU Downloader Inline] ✓ MATCHED upload_references API!');
        console.log('[XMU Downloader Inline] Matched URL:', url);
        const clonedResponse = response.clone();

        clonedResponse.json().then(data => {
          console.log('[XMU Downloader Inline] API Response data:', data);
          processFilesData(data);
        }).catch(err => {
          console.error('[XMU Downloader Inline] 解析响应失败:', err);
        });
      }
    }

    return response;
  };

  console.log('[XMU Downloader Inline] Fetch interceptor installed');

  // 拦截 XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;

    if (typeof url === 'string' && url.includes('/api/')) {
      console.log('[XMU Downloader Inline] XHR API request:', url);
    }

    return originalOpen.apply(this, [method, url, ...rest]);
  };

  XMLHttpRequest.prototype.send = function(...args) {
    const self = this;

    this.addEventListener('load', function() {
      if (self._url && typeof self._url === 'string') {
        const isUploadRef = self._url.includes('upload_reference') || self._url.includes('upload-reference');
        const isActivities = self._url.includes('/api/activities/');
        const hasReference = self._url.includes('reference');

        if ((isActivities && isUploadRef) || (isActivities && hasReference)) {
          console.log('[XMU Downloader Inline] ✓ MATCHED upload_references API via XHR!');
          console.log('[XMU Downloader Inline] Matched URL:', self._url);
          try {
            const data = JSON.parse(this.responseText);
            console.log('[XMU Downloader Inline] XHR Response data:', data);
            processFilesData(data);
          } catch (err) {
            console.error('[XMU Downloader Inline] 解析响应失败:', err);
          }
        }
      }
    });

    return originalSend.apply(this, args);
  };

  console.log('[XMU Downloader Inline] XHR interceptor installed');

  // 处理文件数据
  function processFilesData(data) {
    console.log('[XMU Downloader Inline] Processing files data...');
    console.log('[XMU Downloader Inline] Data keys:', Object.keys(data));

    const references = data.referances || data.references || data.value || [];
    console.log('[XMU Downloader Inline] Found references:', references);

    if (references && references.length > 0) {
      const files = references.map(ref => {
        console.log('[XMU Downloader Inline] Processing reference:', ref);
        return {
          id: ref.id || ref.reference_id,
          name: ref.name || ref.reference_name || ref.title || '未命名文件'
        };
      });

      console.log('[XMU Downloader Inline] Extracted files:', files);
      updateFilesList(files);
    } else {
      console.log('[XMU Downloader Inline] No files found in response');
      updateFilesList([]);
    }
  }

  // 页面加载完成后检查文件
  window.addEventListener('load', function() {
    console.log('[XMU Downloader Inline] Window load event fired');
    checkAndFetchFiles();
  });

  // hash变化时检查文件
  window.addEventListener('hashchange', function() {
    console.log('[XMU Downloader Inline] Hash changed, checking for activity ID...');
    checkAndFetchFiles();
  });

  // 检查并获取文件
  function checkAndFetchFiles() {
    const url = window.location.href;
    console.log('[XMU Downloader Inline] Analyzing URL:', url);

    let activityId = null;

    // 尝试从hash中提取activity ID
    const hashMatch = window.location.hash.match(/#\/(\d+)/);
    if (hashMatch) {
      activityId = hashMatch[1];
      console.log('[XMU Downloader Inline] ✓ Found activity ID in hash:', activityId);
    }

    // 尝试从路径中提取activity ID
    if (!activityId) {
      const pathMatch = url.match(/\/activities\/(\d+)/);
      if (pathMatch) {
        activityId = pathMatch[1];
        console.log('[XMU Downloader Inline] ✓ Found activity ID in path:', activityId);
      }
    }

    // 尝试从learning-activity中提取
    if (!activityId) {
      const learningMatch = url.match(/learning-activity\/[^#]*#\/(\d+)/);
      if (learningMatch) {
        activityId = learningMatch[1];
        console.log('[XMU Downloader Inline] ✓ Found activity ID in learning-activity:', activityId);
      }
    }

    if (activityId) {
      console.log('[XMU Downloader Inline] Activity ID confirmed:', activityId);
      fetchFilesForActivity(activityId);
    } else {
      console.log('[XMU Downloader Inline] ❌ No activity ID found in URL');
    }
  }

  // 获取活动的文件
  function fetchFilesForActivity(activityId) {
    const apiUrl = `https://lnt.xmu.edu.cn/api/activities/${activityId}/upload_references`;
    console.log('[XMU Downloader Inline] Attempting to fetch:', apiUrl);

    fetch(apiUrl, {
      credentials: 'include'
    })
      .then(response => {
        console.log('[XMU Downloader Inline] Fetch response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[XMU Downloader Inline] ✓ Successfully fetched data:', data);
        processFilesData(data);
      })
      .catch(error => {
        console.error('[XMU Downloader Inline] Fetch error:', error);
      });
  }

  console.log('[XMU Downloader Inline] All interceptors ready!');
  console.log('[XMU Downloader Inline] Waiting for API requests...');

  // 导出测试函数
  window.XMUDownloaderTest = function() {
    console.log('[XMU Downloader Inline] Manual test function called');
    checkAndFetchFiles();
  };

  console.log('[XMU Downloader Inline] Type XMUDownloaderTest() to manually trigger file detection');
})();

