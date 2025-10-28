document.addEventListener('DOMContentLoaded', function() {
  const filesList = document.getElementById('filesList');
  const emptyState = document.getElementById('emptyState');
  const refreshBtn = document.getElementById('refreshBtn');
  const downloadAllBtn = document.getElementById('downloadAllBtn');
  const statusDiv = document.getElementById('status');

  let currentFiles = [];

  console.log('[Popup] Popup opened');

  // 加载文件列表
  function loadFiles() {
    console.log('[Popup] Loading files...');

    chrome.runtime.sendMessage({ type: 'GET_FILES' }, function(response) {
      console.log('[Popup] Response:', response);

      if (chrome.runtime.lastError) {
        console.error('[Popup] Error:', chrome.runtime.lastError);
        tryLoadFromStorage();
        return;
      }

      if (!response) {
        console.error('[Popup] No response');
        tryLoadFromStorage();
        return;
      }

      currentFiles = response.files || [];
      console.log('[Popup] Files count:', currentFiles.length);
      displayFiles(currentFiles);
    });
  }

  function tryLoadFromStorage() {
    console.log('[Popup] Loading from storage...');
    chrome.storage.local.get(['filesList'], function(result) {
      console.log('[Popup] Storage result:', result);
      currentFiles = result.filesList || [];
      displayFiles(currentFiles);
    });
  }

  function displayFiles(files) {
    console.log('[Popup] Displaying', files ? files.length : 0, 'files');

    if (!files || files.length === 0) {
      console.log('[Popup] No files, showing empty state');
      filesList.style.display = 'none';
      emptyState.style.display = 'block';
      downloadAllBtn.style.display = 'none';
      return;
    }

    console.log('[Popup] Rendering files...');
    filesList.style.display = 'block';
    emptyState.style.display = 'none';
    downloadAllBtn.style.display = 'block';
    filesList.innerHTML = '';

    files.forEach(function(file, index) {
      console.log('[Popup] Creating item', index, ':', file);

      const div = document.createElement('div');
      div.className = 'file-item';

      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';

      const fileName = document.createElement('div');
      fileName.className = 'file-name';
      fileName.textContent = file.name;
      fileName.title = file.name;

      const fileId = document.createElement('div');
      fileId.className = 'file-id';
      fileId.textContent = 'ID: ' + file.id;

      fileInfo.appendChild(fileName);
      fileInfo.appendChild(fileId);

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-btn';
      downloadBtn.textContent = '下载';
      downloadBtn.onclick = function() {
        console.log('[Popup] Downloading file:', file.name);
        downloadBtn.disabled = true;
        downloadBtn.textContent = '下载中...';

        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_FILE',
          fileId: file.id,
          fileName: file.name
        }, function(response) {
          if (response && response.success) {
            showStatus('正在下载: ' + file.name, 'success');
            downloadBtn.textContent = '已开始';
            setTimeout(function() {
              downloadBtn.textContent = '下载';
              downloadBtn.disabled = false;
            }, 2000);
          } else {
            showStatus('下载失败', 'error');
            downloadBtn.textContent = '重试';
            downloadBtn.disabled = false;
          }
        });
      };

      div.appendChild(fileInfo);
      div.appendChild(downloadBtn);
      filesList.appendChild(div);
    });

    console.log('[Popup] All files rendered');
  }

  function downloadAllFiles() {
    if (currentFiles.length === 0) return;

    console.log('[Popup] Downloading all', currentFiles.length, 'files');
    downloadAllBtn.disabled = true;
    downloadAllBtn.textContent = '下载中...';

    let completed = 0;
    currentFiles.forEach(function(file, index) {
      setTimeout(function() {
        chrome.runtime.sendMessage({
          type: 'DOWNLOAD_FILE',
          fileId: file.id,
          fileName: file.name
        }, function() {
          completed++;
          if (completed === currentFiles.length) {
            showStatus('已开始下载 ' + currentFiles.length + ' 个文件', 'success');
            downloadAllBtn.textContent = '下载全部';
            downloadAllBtn.disabled = false;
          }
        });
      }, index * 500);
    });
  }

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = 'status show ' + (type || 'info');
    setTimeout(function() {
      statusDiv.className = 'status';
    }, 3000);
  }

  refreshBtn.addEventListener('click', function() {
    console.log('[Popup] Refresh clicked');
    loadFiles();
  });

  downloadAllBtn.addEventListener('click', function() {
    console.log('[Popup] Download all clicked');
    downloadAllFiles();
  });

  // 立即加载
  console.log('[Popup] Initializing...');
  loadFiles();
});

