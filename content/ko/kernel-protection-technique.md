---
title: "[KERNEL] 보호 기법"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ SMEP (Supervisor Mode Execution Prevention)커널 공간의 코드를 실행하는 동안 유저 공간의 코드를 실행하는 것을 막는 기법이다.유저 공간에서의 코드의 실행을 막는 NX(No Exute)와 유사하다.하드웨어 보안 기법으"
date: "2024-06-13"
translation_key: "tistory-d725f51a7ecb"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-%EB%B3%B4%ED%98%B8-%EA%B8%B0%EB%B2%95"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

#### SMEP (Supervisor Mode Execution Prevention)

커널 공간의 코드를 실행하는 동안 유저 공간의 코드를 실행하는 것을 막는 기법이다.

유저 공간에서의 코드의 실행을 막는 NX(No Exute)와 유사하다.

하드웨어 보안 기법으로, CR4 레지스터의 21번째 비트가 활성화되면 SMEP가 걸린 것이다.

설정 방법은 커널 환경을 구축하는 sh파일에 아래와 같은 부분을 추가해주면 된다.

```
-cpu kvm64, +smep
```

환경 내부에서 보호기법이 걸려있는지 확인할려면 아래 명령을 실행하면 된다.

```
cat /proc/cpuinfo | grep smep
```

* * *

#### SMAP (Supervisor Mode Access Prevention)

유저 공간에서 커널 공간의 메모리를 읽고 쓸 수 없는 것은 제한되어 있지만 커널 공간에서 유저 공간의 메모리를 읽는 것은 제한이 되어있지 않다. 이런 경우를 막는 것이 방지하는 것이 SMAP이다.

리눅스 커널은 매우 크기 때문에 아래와 같은 gadget이 존재한다.

```
mov esp, 0x12345678; ret;
```

유저 공간에서 mmap()을 활용하여 rop chain을 구성할 수 있다.

```
void *p = mmap(0x12340000, 0x10000, ...);
unsigned long *chain = (unsigned long*)(p + 0x5678);
*chain++ = rop_pop_rdi;
*chain++ = 0;
*chain++ = ...;
...

control_rip(rop_mov_esp_12345678h);
```

SMEP만 걸려있다고 가정했을 때, mmap()으로 할당된 공간은 실행에 제한이 걸리지 않는다. 

즉, 위 코드를 실행한다면 rip를 조작이 가능하다는 것인데, SMAP가 걸리게 된다면 유저 공간에서 0x12345678을 사용했지만 커널 공간에서는 해당 값을 일을 수 없게 된다.

Stack Pivoting을 방지하게 되는 것이다.

하드웨어 보안 기법으로, CR4 레지스터의 22번째 비트가 활성화되면 SMEP가 걸린 것이다.

환경을 구축하는 스크립트 파일에서 다음과 같은 명령을 추가하면 설정이 가능하다.

```
-cpu kvm64,+smap
```

환경 내부에서 기법이 걸려있는지는 아래의 명령을 통해 살펴볼 수 있다.

```
cat /proc/cpuinfo | grep smap
```

* * *

#### KASLR /  KGKASLR

유저 공간에는 메모리 주소를 랜덤화하는 ASLR 기법이 있다. 

동일하게 커널 공간에서 역시 리눅스 커널이나 디바이스 드라이버의 코드/데이터 영역의 주소를 랜덤화 KASLR 기법이 있다.

커널은 한번 로딩되면 재부팅하기 전까지 바뀌지 않기 때문에 KASLR은 초기 부팅 시 한번만 작동하게 된다.

아래의 코드를 통해 설정을 제어할 수 있다.

```
-append "... nokaslr ..."
```

* * *

#### KPTI (Kernel Page-Table Isolation)

커널 공간의 메모리를 유저 권한으로 읽을 수 있는 취약점인 Meltdown이라는 취약점에 대한 대응 방안으로 나오게된 보호 기법이다.

가상 주소에서 물리 주소로 변환할 때 page-table을 사용되는데, 이는 커널 공간과 유저 공간을 구분해주는 역할을 한다.

일반적으로 exploit에는 문제가 되지 않지만 Kernel에서 ROP를 수행 후 ret2usr 등의 과정에서 차단될 수 있다.

```
# kpti on
-append "... pti=on ..."

# kpti off
-append "... pti=off ..."
-append "... nopti ..."
```

커널 환경안에서 다음과 같은 명령을 통해 학인할 수. ㅣㅆ다.

```
# cat /sys/devices/system/cpu/vulnerabilities/meltdown
Mitigation: PTI
```

* * *

#### KADR (Kernel Address Display Restriction)

커널는 함수의 이름과 정보를 /proc/kallsyms, 드라이버에 따라서 printk() 등을 활용하여 읽을 수 있다.

이와 같이 커널 공간에서 함수나 데이터, 힙 등의 주소 정보의 유출을 막기 위한 기법을 통상 KADR이라고 한다.

/proc/sys/kernel/kptr\_restrict 파일의 값을 기반으로 보호 정도가 설정된다.

0 : 주소 표시

1 : CAP\_SYSLOG 권한의 사용자에게만 표시

2 : 주소 표시 안함
