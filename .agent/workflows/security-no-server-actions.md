---
description: prismLM 보안 개발 가이드라인 - CVE-2025-55182 취약점 예방
---

# 🔒 보안 개발 가이드라인

## CVE-2025-55182 (React2Shell) 취약점 예방

**작성일**: 2025-12-15  
**적용 대상**: prismLM 프로젝트 전체

---

## ⛔ 사용 금지 항목

아래 React Server Actions 관련 기능은 **절대 사용하지 않습니다**:

### 1. 'use server' 지시어

```tsx
// ❌ 사용 금지
"use server";

export async function submitAction() {
  // Server Action 로직
}
```

### 2. action 속성

```tsx
// ❌ 사용 금지
<form action={serverAction}>
  <button type="submit">제출</button>
</form>
```

### 3. formAction 속성

```tsx
// ❌ 사용 금지
<button formAction={serverAction}>제출</button>
```

---

## ✅ 대안 사용 권장

Server Actions 대신 아래 패턴을 사용합니다:

### 1. API Route 사용 (권장)

```tsx
// src/app/api/submit/route.ts
export async function POST(request: Request) {
  const data = await request.json();
  // 서버 로직 처리
  return Response.json({ success: true });
}

// 클라이언트에서 호출
const handleSubmit = async () => {
  await fetch("/api/submit", {
    method: "POST",
    body: JSON.stringify(data),
  });
};
```

### 2. Client-side 폼 처리

```tsx
"use client";

export function MyForm() {
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // API 호출 또는 클라이언트 로직
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

---

## 📋 코드 리뷰 체크리스트

새 코드 작성 또는 리뷰 시 다음 사항 확인:

- [ ] `'use server'` 지시어가 없는가?
- [ ] `<form action={...}>` 패턴이 없는가?
- [ ] `formAction` 속성이 없는가?
- [ ] Server Actions 대신 API Route를 사용했는가?

---

## 🔍 정기 점검 명령어

프로젝트에서 Server Actions 사용 여부 검사:

```powershell
# 'use server' 검색
rg "use server" ./frontend/src

# action 속성 검색
rg "action=" ./frontend/src --type tsx

# formAction 검색
rg "formAction" ./frontend/src
```

---

## 📚 참고 자료

- [CVE-2025-55182 상세 보고서](file:///C:/Users/chyon/.gemini/antigravity/brain/ebcab65c-766d-410d-a7aa-d82e1296ae26/security_report_cve-2025-55182.md)
- [Next.js 공식 보안 권고](https://nextjs.org/blog/CVE-2025-66478)
- [react2shell-scanner GitHub](https://github.com/assetnote/react2shell-scanner)

---

> ⚠️ **중요**: 이 가이드라인은 향후 Next.js 15.x 이상으로 업그레이드하더라도 취약점에 노출되지 않도록 하기 위한 예방 조치입니다.
