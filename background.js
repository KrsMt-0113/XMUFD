// 存储文件信息
let filesList = [];

console.log('[XMU Downloader Background] Service worker started');

// 从storage恢复数据
chrome.storage.local.get(['filesList'], function(result) {
  if (result.filesList) {
    filesList = result.filesList;
    console.log('[XMU Downloader Background] Restored files from storage:', filesList.length);
  }
});

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[XMU Downloader Background] Message received:', request.type);

  if (request.type === 'FILES_DETECTED') {
    filesList = request.files;
    console.log('[XMU Downloader Background] Files list updated:', filesList);

    // 持久化到storage
    chrome.storage.local.set({ filesList: filesList }, function() {
      console.log('[XMU Downloader Background] Files saved to storage');
    });

    // 更新badge显示文件数量
    if (sender.tab && sender.tab.id) {
      chrome.action.setBadgeText({
        text: filesList.length > 0 ? filesList.length.toString() : '',
        tabId: sender.tab.id
      });
      chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
      console.log('[XMU Downloader Background] Badge updated:', filesList.length);

      // 自动打开弹窗
      if (filesList.length > 0) {
        chrome.action.openPopup();
        console.log('[XMU Downloader Background] Auto-opening popup');
      }
    }
    sendResponse({ success: true });
  } else if (request.type === 'GET_FILES') {
    console.log('[XMU Downloader Background] GET_FILES request received');
    console.log('[XMU Downloader Background] Current files list:', filesList);
    console.log('[XMU Downloader Background] Files count:', filesList.length);
    const response = { files: filesList };
    console.log('[XMU Downloader Background] Sending response:', response);
    sendResponse(response);
    return true; // 保持消息通道开放
  } else if (request.type === 'DOWNLOAD_FILE') {
    console.log('[XMU Downloader Background] Download request:', request.fileName);
    // 下载文件
    downloadFile(request.fileId, request.fileName)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // 保持消息通道开放以进行异步响应
  }
});

// 获取文件下载URL并下载
async function downloadFile(fileId, fileName) {
  try {
    const apiUrl = `https://lnt.xmu.edu.cn/api/uploads/reference/document/${fileId}/url?preview=true`;

    // 发送请求获取下载链接
    const response = await fetch(apiUrl, {
      credentials: 'include' // 包含cookies以保持登录状态
    });

    const data = await response.json();

    if (data.status === 'ready' && data.url) {
      // 使用Chrome下载API下载文件
      chrome.downloads.download({
        url: data.url,
        filename: fileName,
        saveAs: true
      });
    } else {
      throw new Error('无法获取下载链接');
    }
  } catch (error) {
    console.error('下载失败:', error);
    throw error;
  }
}

// 清除badge当标签页关闭时
chrome.tabs.onRemoved.addListener((tabId) => {
  filesList = [];
});

// 当标签页更新时重置文件列表
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    filesList = [];
    chrome.action.setBadgeText({ text: '', tabId: tabId });
  }
});

