// XMU 下载器 Background Service Worker
console.log('[XMU Downloader Inline Background] Service worker started');

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[XMU Downloader Inline Background] Message received:', request.type);

  if (request.type === 'DOWNLOAD_FILE') {
    console.log('[XMU Downloader Inline Background] Download request:', request.fileName);
    downloadFile(request.fileId, request.fileName)
      .then(() => {
        console.log('[XMU Downloader Inline Background] Download success');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('[XMU Downloader Inline Background] Download error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 保持消息通道开启以进行异步响应
  }
});

// 下载文件函数
async function downloadFile(fileId, fileName) {
  console.log('[XMU Downloader Inline Background] Starting download:', fileName, 'ID:', fileId);

  try {
    // 先获取文件的真实下载地址
    const apiUrl = `https://lnt.xmu.edu.cn/api/uploads/reference/document/${fileId}/url?preview=true`;
    console.log('[XMU Downloader Inline Background] Fetching download URL from:', apiUrl);

    const response = await fetch(apiUrl, {
      credentials: 'include'
    });

    const data = await response.json();
    console.log('[XMU Downloader Inline Background] API response:', data);

    if (data.status === 'ready' && data.url) {
      console.log('[XMU Downloader Inline Background] Got download URL:', data.url);

      // 触发下载
      chrome.downloads.download({
        url: data.url,
        filename: fileName,
        saveAs: true
      });

      console.log('[XMU Downloader Inline Background] Download initiated');
    } else {
      throw new Error('无法获取下载链接');
    }
  } catch (error) {
    console.error('[XMU Downloader Inline Background] Download failed:', error);
    throw error;
  }
}

console.log('[XMU Downloader Inline Background] Ready to handle download requests');

