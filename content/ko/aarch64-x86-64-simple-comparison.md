---
title: "[AArch64] x86_64 간단 비교"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 효율적인 전력 사용과 높은 성능의 위해서 설계된 architecture이다. 주로 스마트폰, 임베디드 시스템 등의 환경에서 사용되고 있다. 간단하게 x86_64와 비교해보겠다. #include int main(int argc, char*argv[])"
date: "2024-03-20"
translation_key: "tistory-ea29bb13e5df"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-x8664-%EA%B0%84%EB%8B%A8-%EB%B9%84%EA%B5%90"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※**** 

효율적인 전력 사용과 높은 성능의 위해서 설계된 architecture이다.

주로 스마트폰, 임베디드 시스템 등의 환경에서 사용되고 있다.

간단하게 x86\_64와 비교해보겠다.

```
#include <stdio.h>

int main(int argc, char*argv[]){
	printf("Hello world!\n");
	return 0;
}
```

위의 코드를 아래의 두 가지 방법으로 컴파일을 진행한다.

```
aarch64-linux-gnu-gcc -static -no-pie -o test test.c
```

```
gcc -no-pie -static -o x86 test.c
```

AArch64로 정상적으로 컴파일 되었는지 확인하는 방법이다.

![](/assets/images/tistory/tistory-ea29bb13e5df/001.png)

해당 파일을 그대로 실행 혹은 디버깅 할려고 하면 안될 것이다.

AArch64 ld, libc 파일이 없기 때문인데 아래의 경로를 통해 설치를 진행한다.

[http://mirror.archlinuxarm.org/aarch64/core/glibc-2.35-5.1-aarch64.pkg.tar.xz](http://mirror.archlinuxarm.org/aarch64/core/glibc-2.35-5.1-aarch64.pkg.tar.xz) 

```
wget http://mirror.archlinuxarm.org/aarch64/core/glibc-2.35-5.1-aarch64.pkg.tar.xz

tar -xvf glibc-2.35-5.1-aarch64.pkg.tar.xz
cd usr/lib/
sudo cp ld-linux-aarch64.so.1 /lib/
sudo cp libc.so.6 /lib/
```

AArch64 디버깅을 위해서 gdb-multiarch를 설치한다.

```
sudo apt -y install gdb-multiarch
```

아래와 같은 방법으로 명령어를 입력해주면 main()을 디버깅할 수 있다.

```
gdb-multiarch
set architecture aarch64
file ./test

disass main
```

![](/assets/images/tistory/tistory-ea29bb13e5df/002.png)

생소한 어셈블리어와 구조가 보인다.

이를 x86\_64와 비교해서 확인해보겠다.

![](/assets/images/tistory/tistory-ea29bb13e5df/003.png)

함수의 prologue, epilogue의 형태가 \[push, mov,sub\] -> \[stp, mov\] , \[leave-ret\] -> \[ldp-ret\]로 바뀐 것을 볼 수 있다.

이외에도 문자열의 주소를 직접 가져오지 않고 adrp를 통해 상대주소를 계산하여 가져온다.

x86\_64에 비교하여 각 레지스터에 대한 정리한 것이다.

```
X0~X7 = rdi, rsi, rdx, rcx, r8 ,r9 와같은 매개 변수 전달
X8~X18 = 임시 레지스터
X19~X28 = 함수를 호출할 때 기존의 메모리 주소를 보존하기 위해 사용되는 백업용 레지스터
X29 = BasePointer
X30 = RetAddress
SP = StackPointer
```
