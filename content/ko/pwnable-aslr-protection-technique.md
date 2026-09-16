---
title: "[PWNABLE] ASLR 보호기법"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 바이너리가 실행될 때마다 코드 영역을 제외한 스택, 힙, 공유 라이브러리 영역의 주소를 랜덤하게 바꿔주는 보호기법이다. 실행할 때마다 주소가 바뀌는 것을 볼 수 있다. 위 실행 파일의 코드이다. #include #include #include cha"
date: "2023-10-22"
translation_key: "tistory-82c31cff9454"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-ASLR-%EB%B3%B4%ED%98%B8%EA%B8%B0%EB%B2%95"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다.** **※** 

바이너리가 실행될 때마다 코드 영역을 제외한 스택, 힙, 공유 라이브러리 영역의 주소를 랜덤하게 바꿔주는 보호기법이다.

![](/assets/images/tistory/tistory-82c31cff9454/001.png)

실행할 때마다 주소가 바뀌는 것을 볼 수 있다.

위 실행 파일의 코드이다.

```
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
 
char *global = "whrd";
  
int main(){
    char *heap = malloc(100);
    char *stack[] = {"whrd"};
 
    printf("[Heap]  address: %p\n", heap);
    printf("[Stack] address: %p\n", stack);
    printf("[libc]  address: %p\n",**(&stack + 3));
    printf("[.data] address: %p\n",global);
    gets(heap);
    return 0;
}
```

현재 aslr 적용 상태이다.

```
 cat /proc/sys/kernel/randomize_va_space
```

위 명령어를 사용하여 확인할 수 있다.

![](/assets/images/tistory/tistory-82c31cff9454/002.png)

적용 상태는 0, 1, 2로 3가지가 존재한다.

**먼저 0을 적용한 상태**이다.

![](/assets/images/tistory/tistory-82c31cff9454/003.png)

주소의 영역이 변경되지 않는 것을 볼 수 있다.

**1을 적용한 상태**이다.

![](/assets/images/tistory/tistory-82c31cff9454/004.png)

stack과 libc의 영역만 바뀐다.

기본 값인 **2를 적용한 상태**이다.

![](/assets/images/tistory/tistory-82c31cff9454/005.png)

모든 주소가 바뀌는 것을 볼 수 있다.
