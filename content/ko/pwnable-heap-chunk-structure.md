---
title: "[PWNABLE] Heap Chunk Structure"
description: "Memorry Allocator : 한정된 메모리 자원을 각 프로세스에 효율적으로 배분하는 작업을 한다.- 실행중에 메모리를 동적으로 할당 및 해제한다.- 구현에 따라 사용된 알고리즘의 종류가 달라진다 - ptmalloc2은 ubuntu에서 사용한다 ptmalloc2의 특징으로는 해제된 메모리에 대한 데이터를 지우지 않고"
date: "2024-06-24"
translation_key: "tistory-c084fac95b4c"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Heap-Chunk-Structure"
private: false
---

Memorry Allocator 

: 한정된 메모리 자원을 각 프로세스에 효율적으로 배분하는 작업을 한다.

\- 실행중에 메모리를 동적으로 할당 및 해제한다.

\- 구현에 따라 사용된 알고리즘의 종류가 달라진다 - ptmalloc2은 ubuntu에서 사용한다

ptmalloc2의 특징으로는 해제된 메모리에 대한 데이터를 지우지 않고 가지고 있다가

비슷한 요청이 오면 반환해주는 특징이 있다.

\- 메모리 낭비 방지

\- 빠른 메모리 재사용  
  tcache 혹은 bin이라는 리스트를 사용한다.

\- 메모리 단편화 방식  
  단편화를 줄이기 위해 정렬, 병합, 분할을 사용한다.

#### chunk

ptmalloc에 의해 할당된 공간으로 

헤더 + 데이터 영역으로 구성되어 있다.

헤더에는 청크의 상태와 크기를 가리키기 때문에 사용중인 청크와 해제된 청크의 구조가 다르다.

![](/assets/images/tistory/tistory-c084fac95b4c/001.png)

해제된 청크의 헤더를 보면 fd와 bk가 존재한다.

fd : 연결 리스트에서 다음 청크를 가리킨다.

bk : 연결 리스트에서 이전청크를 가리킨다.

![](/assets/images/tistory/tistory-c084fac95b4c/002.png)

allocated chunk

![](/assets/images/tistory/tistory-c084fac95b4c/003.png)

freed chunk

#### bin

사용이 끝난 청크들이 저장되는 객체이다.

bin에 임시 저장되었다가 할당 요청이 오면 사용되기 때문에 '메미로 낭비 방지 및 해제된 청크들의 빠른 재사용'에 도움이 된다.

bin은 크기에 따라 나뉘어진다.

-   smallbin  
    32~1024바이트의 크기를 가진 청크들이 보관된다.  
    이중 연결 리스트 방식 및 FIFO 방식을 사용한다.  
    이중연결 리스트는 특성상 청크를 추가 혹은 해제를 위해 연결을 끊는 과정이 필요하다.  
    이 과정을 unlink라고 한다.  
    ptmalloc의 병합대상이기 때문에 smallbin이 들어있는 인접한 두개의 청크가 병합된다.->consolidation
-   fastbin  
    32~176바이트의 크기를 가진 청크들이 보관된다.  
    16바이트 단위로 10개가 존재한다.  
    단일 연결리스트 방식이기떄문에 unlink과정이 불필요하다. => 속도 증가
-   largebin  
    1024바이트 이상의 크기를 가진 청크들이 보관된다.  
    일정 범위 안의 크기를 갖는 청크들을 모두 보관한다.  
    재할당 요청이 발생하면 가장 비슷한 크기의 청크를 재할당시켜주기 위해 내림차순으로 정렬되어 있다.  
    이중연결방식이다.
-   unsortedbin  
    분류되지 않은 청크들을 보관한다.  
    하나만 존재하며 fastbin에 들어가지 않은 모든 청크들은 해제되면 unsortedbin에 보관된다  
    이중연결리스트 방식이다.

![](/assets/images/tistory/tistory-c084fac95b4c/004.png)

arena에서bin을 이용하여 시스템을 효율적으로 관리한다.

그리고 tcache를 이용하여 쓰레드 환경의 최적화를 지원한다.

tcache는 쓰레드마다 64개를 가지고 있고, 각 tcache마다 7개의 청크를 가지고 있다.

때문에 레이스 컨디션을 고려할 필요가 없으며 bin보다 먼저 사용되기 때문에 병목 현상을 완화시킨다.  
그리고 하나의 tcache에는 같은 크기의 청크들만 보관되게 된다.
