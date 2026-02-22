// extractor.js — 네이버 지식인 질문 텍스트 추출
// 지식인은 iframe이 아니므로 document에서 직접 접근 가능

(function () {
  'use strict';

  // 첫 번째로 매칭되는 셀렉터의 요소 반환
  function q(selectors) {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 0) return el;
    }
    return null;
  }

  function extractQuestion() {
    // ── 질문 제목 추출 ──
    const titleSelectors = [
      // 최신 (2025~2026)
      '.c-heading__title',
      '.c-heading .title',
      '.question-title',
      '.questionDetail .title',
      '.title_area .title',
      '.question_title',
      'h3.title',
      'h2.title',
      // 모바일
      '.qna_title .title',
      '.question_head .title',
      // 최종 폴백: 페이지 내 첫 h3
      '#content h3',
    ];
    const titleEl = q(titleSelectors);
    let title = titleEl?.textContent?.trim() || '';

    // og:title 메타태그 폴백
    if (!title) {
      const ogTitle = document.querySelector('meta[property="og:title"]');
      if (ogTitle) {
        title = ogTitle.getAttribute('content')?.trim()
          ?.replace(/ : 지식iN$/, '')
          ?.replace(/ - 네이버.*$/, '') || '';
      }
    }

    // document.title 폴백
    if (!title) {
      const dt = document.title || '';
      const cleaned = dt.replace(/ : 지식iN$/, '').replace(/ - 네이버.*$/, '').trim();
      if (cleaned.length > 3 && cleaned.length < 200) title = cleaned;
    }

    // ── 질문 본문 추출 ──
    const contentSelectors = [
      // 최신 (2025~2026)
      '.c-heading__content',
      '.c-heading._questionContentsArea .c-heading__content',
      '._questionContentsArea',
      '.question-content',
      '.question-content-area',
      '.questionDetail .se-main-container',
      '.endContentBody',
      '.end_content',
      '._endContents',
      // 추가 후보
      '.question_area .c-heading__content',
      '.question_area .content',
      '.detail_content',
      '.content_area .question',
      '.qna_content_wrap .c-heading__content',
      // 모바일
      '.qna_content .content',
      '.question_content',
      '.se-main-container',
      // 넓은 범위 폴백
      '#content .c-heading__content',
      '#content .question-content',
    ];
    const contentEl = q(contentSelectors);
    let content = contentEl?.innerText?.trim() || '';

    // ── 본문 휴리스틱 폴백 ──
    // 셀렉터로 못 찾으면, 질문 영역 내 가장 긴 텍스트 블록 탐색
    if (!content) {
      const wrapperSelectors = [
        '.questionDetail',
        '.question-area',
        '.question_area',
        '.c-heading',
        '#content',
      ];
      for (const wSel of wrapperSelectors) {
        const wrapper = document.querySelector(wSel);
        if (!wrapper) continue;

        // wrapper 안의 div/p/span 중 텍스트가 가장 긴 것 선택
        const candidates = wrapper.querySelectorAll('div, p, span');
        let best = '';
        for (const el of candidates) {
          // 자식이 너무 많은 컨테이너는 건너뜀
          if (el.children.length > 10) continue;
          const t = el.innerText?.trim() || '';
          if (t.length > best.length && t.length < 5000) best = t;
        }
        if (best.length > 10) {
          content = best;
          break;
        }
      }
    }

    // ── og:description 폴백 ──
    if (!content) {
      const ogDesc = document.querySelector('meta[property="og:description"]');
      if (ogDesc) {
        content = ogDesc.getAttribute('content')?.trim() || '';
      }
    }

    // 태그 추출
    const tagEls = document.querySelectorAll(
      '.tag_area a, .question_tag a, ._tagArea a, .keyword_area a, .tag-list a'
    );
    const tags = Array.from(tagEls).map(el => el.textContent.trim()).filter(Boolean);

    // 카테고리 추출
    const categoryEl =
      document.querySelector('.breadcrumb .item:last-child') ||
      document.querySelector('.category_area a') ||
      document.querySelector('.depth a') ||
      document.querySelector('.nav_area a:last-child');
    const category = categoryEl?.textContent?.trim() || '';

    // 질문자 정보
    const askerEl = document.querySelector(
      '.questioner .nickname, .c-userinfo__name, .profile_info .name, .writer_info .name'
    );
    const asker = askerEl?.textContent?.trim() || '';

    // 기존 답변 수
    const answerCountEl = document.querySelector(
      '.answer-count, ._answerCount, .answerCount, .answer_count, .count_answer'
    );
    const answerCount = answerCountEl?.textContent?.replace(/[^0-9]/g, '') || '0';

    return {
      title,
      content,
      tags,
      category,
      asker,
      answerCount: parseInt(answerCount) || 0,
      url: window.location.href,
      charCount: content.length,
      extractedAt: new Date().toISOString()
    };
  }

  // 메시지 리스너
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractQuestion') {
      const data = extractQuestion();

      if (data.content && data.content.length > 5) {
        sendResponse({ success: true, data });
      } else if (data.title && data.title.length > 3) {
        data.content = data.title;
        sendResponse({ success: true, data });
      } else {
        sendResponse({
          success: false,
          error: '질문 내용을 찾을 수 없습니다. 지식인 질문 페이지에서 실행해주세요.'
        });
      }
      return true;
    }

    if (request.action === 'ping') {
      sendResponse({ alive: true, url: window.location.href });
      return true;
    }
  });
})();
