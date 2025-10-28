// 拦截XHR和Fetch请求以捕获API响应
(function() {
  'use strict';

  console.log('[XMU Downloader] Content script loaded!');
  console.log('[XMU Downloader] Current URL:', window.location.href);
  console.log('[XMU Downloader] Time:', new Date().toLocaleTimeString());

  // 拦截Fetch API
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const url = args[0];

    // 记录所有API请求以便调试
    if (typeof url === 'string' && url.includes('/api/')) {
      console.log('[XMU Downloader] Fetch API request:', url);
    }

    const response = await originalFetch.apply(this, args);

    // 检查是否是目标API - 使用更宽松的匹配
    if (typeof url === 'string') {
      const isUploadRef = url.includes('upload_reference') || url.includes('upload-reference');
      const isActivities = url.includes('/api/activities/');
      const hasReference = url.includes('reference');

      if ((isActivities && isUploadRef) || (isActivities && hasReference)) {
        console.log('[XMU Downloader] ✓ MATCHED upload_references API!');
        console.log('[XMU Downloader] Matched URL:', url);
        // 克隆响应以便我们可以读取它
        const clonedResponse = response.clone();

        clonedResponse.json().then(data => {
          console.log('[XMU Downloader] API Response data:', data);
          processFilesData(data);
        }).catch(err => {
          console.error('[XMU Downloader] 解析响应失败:', err);
        });
      }
    }

    return response;
  };

  console.log('[XMU Downloader] Fetch interceptor installed');

  // 拦截XMLHttpRequest
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._url = url;

    // 记录所有API请求以便调试
    if (typeof url === 'string' && url.includes('/api/')) {
      console.log('[XMU Downloader] XHR API request:', url);
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
          console.log('[XMU Downloader] ✓ MATCHED upload_references API via XHR!');
          console.log('[XMU Downloader] Matched URL:', self._url);
          try {
            const data = JSON.parse(this.responseText);
            console.log('[XMU Downloader] XHR Response data:', data);
            processFilesData(data);
          } catch (err) {
            console.error('[XMU Downloader] 解析响应失败:', err);
          }
        }
      }
    });

    return originalSend.apply(this, args);
  };

  console.log('[XMU Downloader] XHR interceptor installed');

  // 处理文件数据
  function processFilesData(data) {
    console.log('[XMU Downloader] Processing files data...');
    console.log('[XMU Downloader] Data keys:', Object.keys(data));

    // 尝试多种可能的字段名
    const references = data.referances || data.references || data.value || [];
    console.log('[XMU Downloader] Found references:', references);

    if (references && references.length > 0) {
      const files = references.map(ref => {
        console.log('[XMU Downloader] Processing reference:', ref);
        return {
          id: ref.id || ref.reference_id,
          name: ref.name || ref.reference_name || ref.title || '未命名文件'
        };
      });

      console.log('[XMU Downloader] Extracted files:', files);

      // 发送到background script
      chrome.runtime.sendMessage({
        type: 'FILES_DETECTED',
        files: files
      }, response => {
        if (chrome.runtime.lastError) {
          console.error('[XMU Downloader] 发送消息失败:', chrome.runtime.lastError);
        } else {
          console.log('[XMU Downloader] ✓ 成功发送', files.length, '个文件到background');
          console.log('[XMU Downloader] Response:', response);
        }
      });
    } else {
      console.log('[XMU Downloader] No files found in response');
    }
  }

  console.log('[XMU Downloader] All interceptors ready!');
  console.log('[XMU Downloader] Waiting for API requests...');

  // 添加一个全局函数供手动测试
  window.XMUDownloaderTest = function() {
    console.log('[XMU Downloader] Manual test function called');
    console.log('[XMU Downloader] Current interceptors status:');
    console.log('[XMU Downloader] - Fetch:', window.fetch !== originalFetch);
    console.log('[XMU Downloader] - XHR:', XMLHttpRequest.prototype.open !== originalOpen);

    // 列出当前页面发起的所有请求（如果有Performance API）
    if (window.performance && window.performance.getEntriesByType) {
      const resources = window.performance.getEntriesByType('resource');
      console.log('[XMU Downloader] Total resources loaded:', resources.length);
      const apiRequests = resources.filter(r => r.name.includes('/api/'));
      console.log('[XMU Downloader] API requests found:', apiRequests.length);
      apiRequests.forEach(r => {
        console.log('[XMU Downloader]   ->', r.name);
      });
    }
  };

  console.log('[XMU Downloader] Type XMUDownloaderTest() to run diagnostics');

  // 自动运行一次诊断
  setTimeout(function() {
    console.log('[XMU Downloader] === AUTO-RUNNING DIAGNOSTICS ===');
    if (window.performance && window.performance.getEntriesByType) {
      const resources = window.performance.getEntriesByType('resource');
      const apiRequests = resources.filter(r => r.name.includes('/api/'));
      console.log('[XMU Downloader] Total API requests found:', apiRequests.length);
      if (apiRequests.length > 0) {
        console.log('[XMU Downloader] API URLs:');
        apiRequests.forEach(r => {
          console.log('[XMU Downloader]   ->', r.name);
        });
      } else {
        console.log('[XMU Downloader] ❌ No API requests found in performance API');
        console.log('[XMU Downloader] This could mean:');
        console.log('[XMU Downloader] 1. Requests happened before extension loaded');
        console.log('[XMU Downloader] 2. Page uses WebSocket or other methods');
        console.log('[XMU Downloader] 3. Requests are in iframe');
      }
    }
    console.log('[XMU Downloader] === END DIAGNOSTICS ===');
  }, 2000);

  // 监听DOM变化，检测动态加载的内容
  const observer = new MutationObserver(function(mutations) {
    console.log('[XMU Downloader] DOM changed, mutations:', mutations.length);
  });

  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    console.log('[XMU Downloader] MutationObserver started');
  }

  // 监听页面加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      console.log('[XMU Downloader] DOMContentLoaded event fired');
    });
  } else {
    console.log('[XMU Downloader] Document already loaded (readyState:', document.readyState + ')');
  }

  window.addEventListener('load', function() {
    console.log('[XMU Downloader] Window load event fired');
    checkAndFetchFiles();
  });

  // 监听hash变化（单页应用导航）
  window.addEventListener('hashchange', function() {
    console.log('[XMU Downloader] Hash changed, checking for activity ID...');
    checkAndFetchFiles();
  });

  // 检查URL并获取文件
  function checkAndFetchFiles() {
    const url = window.location.href;
    console.log('[XMU Downloader] Analyzing URL:', url);

    // URL格式: https://lnt.xmu.edu.cn/course/72573/learning-activity/full-screen#/653772
    // 活动ID在hash中: #/activityId

    let activityId = null;

    // 方法1: 从hash中提取 (#/数字)
    const hashMatch = window.location.hash.match(/#\/(\d+)/);
    if (hashMatch) {
      activityId = hashMatch[1];
      console.log('[XMU Downloader] ✓ Found activity ID in hash:', activityId);
    }

    // 方法2: 从路径中提取 (/activities/数字)
    if (!activityId) {
      const pathMatch = url.match(/\/activities\/(\d+)/);
      if (pathMatch) {
        activityId = pathMatch[1];
        console.log('[XMU Downloader] ✓ Found activity ID in path:', activityId);
      }
    }

    // 方法3: 从learning-activity路径后提取
    if (!activityId) {
      const learningMatch = url.match(/learning-activity\/[^#]*#\/(\d+)/);
      if (learningMatch) {
        activityId = learningMatch[1];
        console.log('[XMU Downloader] ✓ Found activity ID in learning-activity:', activityId);
      }
    }

    if (activityId) {
      console.log('[XMU Downloader] Activity ID confirmed:', activityId);
      fetchFilesForActivity(activityId);
    } else {
      console.log('[XMU Downloader] ❌ No activity ID found in URL');
      const courseMatch = url.match(/\/course\/(\d+)/);
      if (courseMatch) {
        console.log('[XMU Downloader] Found course ID:', courseMatch[1], '- waiting for activity selection...');
      }
      tryExtractFromDOM();
    }
  }

  // 获取指定活动的文件
  function fetchFilesForActivity(activityId) {
    const apiUrl = `https://lnt.xmu.edu.cn/api/activities/${activityId}/upload_references`;
    console.log('[XMU Downloader] Attempting to fetch:', apiUrl);

    fetch(apiUrl, {
      credentials: 'include'
    })
      .then(response => {
        console.log('[XMU Downloader] Fetch response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log('[XMU Downloader] ✓ Successfully fetched data:', data);
        processFilesData(data);
      })
      .catch(error => {
        console.error('[XMU Downloader] Fetch error:', error);
        console.log('[XMU Downloader] Will retry with alternative methods...');
        tryExtractFromDOM();
      });
  }

  // 从DOM中提取数据的备用方法
  function tryExtractFromDOM() {
    console.log('[XMU Downloader] Trying to extract data from DOM...');

    // 查找可能包含文件信息的元素
    const selectors = [
      '[class*="upload"]',
      '[class*="reference"]',
      '[class*="file"]',
      '[class*="attachment"]',
      'a[href*="reference"]',
      'a[href*="upload"]',
      '[data-reference-id]',
      '[data-file-id]'
    ];

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`[XMU Downloader] Found ${elements.length} elements matching: ${selector}`);
        elements.forEach((el, i) => {
          console.log(`[XMU Downloader]   ${i}:`, el.outerHTML.substring(0, 200));
        });
      }
    });

    // 查找React或Vue的数据
    if (window.__INITIAL_STATE__ || window.__NUXT__) {
      console.log('[XMU Downloader] Found framework state data');
      console.log('[XMU Downloader] __INITIAL_STATE__:', window.__INITIAL_STATE__);
      console.log('[XMU Downloader] __NUXT__:', window.__NUXT__);
    }
  }

  // 添加一个手动触发的测试函数
  window.XMUDownloaderManualCheck = function(testUrl) {
    console.log('[XMU Downloader] === MANUAL CHECK ===');

    if (testUrl) {
      console.log('[XMU Downloader] Testing URL:', testUrl);
      fetch(testUrl, { credentials: 'include' })
        .then(r => {
          console.log('[XMU Downloader] Fetch success, status:', r.status);
          return r.json();
        })
        .then(data => {
          console.log('[XMU Downloader] Response data:', data);
          processFilesData(data);
        })
        .catch(e => {
          console.error('[XMU Downloader] Fetch failed:', e);
        });
    } else {
      // 自动从当前URL提取活动ID
      const hashMatch = window.location.hash.match(/#\/(\d+)/);
      if (hashMatch) {
        const activityId = hashMatch[1];
        console.log('[XMU Downloader] Auto-detected activity ID:', activityId);
        const apiUrl = `https://lnt.xmu.edu.cn/api/activities/${activityId}/upload_references`;
        console.log('[XMU Downloader] Fetching:', apiUrl);
        fetch(apiUrl, { credentials: 'include' })
          .then(r => r.json())
          .then(data => {
            console.log('[XMU Downloader] Response data:', data);
            processFilesData(data);
          })
          .catch(e => console.error('[XMU Downloader] Error:', e));
      } else {
        console.log('[XMU Downloader] No activity ID found in current URL');
        console.log('[XMU Downloader] Usage: XMUDownloaderManualCheck("https://lnt.xmu.edu.cn/api/activities/XXX/upload_references")');
        console.log('[XMU Downloader] Or just: XMUDownloaderManualCheck() to auto-detect from URL');
      }
    }
  };

  console.log('[XMU Downloader] Type XMUDownloaderManualCheck() to manually check current page');
  console.log('[XMU Downloader] Or XMUDownloaderManualCheck(url) to test specific URL');
})();

