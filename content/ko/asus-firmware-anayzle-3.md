---
title: "[ASUS] FIRMWARE ANAYZLE #3"
description: "IPTIME을 계속해서 분석 시도해보다가 해당 모델을 대상으로는 장비를 구비하지 않고는 혹은 기존 장비를 뜯어보지 않으면 진전을 하지 못할 것 같아 TARGET을 변경하여 시도해보았다. 이번에는 제발 에뮬레이팅을 편하게 하고 싶어 FIRMAE를 포함한 에뮬레이팅 도구들을 사용하며 리스트를 정리하면서 TARGET 선정하고자"
date: "2025-06-23"
translation_key: "tistory-7789b9c0fa08"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/ASUS-FIRMWARE-ANAYZLE-3"
private: false
---

IPTIME을 계속해서 분석 시도해보다가 해당 모델을 대상으로는 장비를 구비하지 않고는 혹은 기존 장비를 뜯어보지 않으면 진전을 하지 못할 것 같아 TARGET을 변경하여 시도해보았다.

![](/assets/images/tistory/tistory-7789b9c0fa08/001.png)

이번에는 제발 에뮬레이팅을 편하게 하고 싶어 FIRMAE를 포함한 에뮬레이팅 도구들을 사용하며 리스트를 정리하면서 TARGET 선정하고자 하였다. 하지만 놀랍게도 내 환경에서는 성공한 적이 없다...

결국 적당한 장비 하나를 선정하여 직접 에뮬레이팅 하고 분석해보기로 하였다.

선정한 장비는 ASUS의 RT\_AX57이다.

![](/assets/images/tistory/tistory-7789b9c0fa08/002.png)

처음 플젝 시작은 2인으로 시작하였기에 인당 4만원 정도의 이 장비를 선정했었다.

(흠... 중간에 혼자 진행하게됨...)

일단 이 장비도 에뮬레이팅 툴을 활용한 시도는 실패했다.

![](/assets/images/tistory/tistory-7789b9c0fa08/003.png)

![](/assets/images/tistory/tistory-7789b9c0fa08/004.png)

binwalk를 통해 확인해보면 iptime에 비해 복잡하게 나오는 것을 볼 수 있다. 

dtb, kernel img, rootfs 의 구조는 동일하게 가지고 있지만 내부 속성들이 더 분할되어 보여주고 있다. 이에 대한 하나씩 추출해보며 분석에 대한 정리는 iptime에서 한번 진행을 했었기 때문에 따로 작성안하겠다.

![](/assets/images/tistory/tistory-7789b9c0fa08/005.png)

ARM 아키텍처를 사용하고 있다.

![](/assets/images/tistory/tistory-7789b9c0fa08/006.png)

우선 httpd 프로토콜이 존재하는 것을 확인했다.

![](/assets/images/tistory/tistory-7789b9c0fa08/007.png)

![](/assets/images/tistory/tistory-7789b9c0fa08/008.png)

IDA PRO를 통해 분석해본 결과 iptime과는 다르게 boa 프로세스의 이름을 바꿔둔 것이 아닌 httpd 인 것을 확인했다.

![](/assets/images/tistory/tistory-7789b9c0fa08/009.png)

cgi 파일들이 있는지를 확인해보았는데 추출된 파일들에서는 존재하지 않는다.

![](/assets/images/tistory/tistory-7789b9c0fa08/010.png)

그럼에도 cgi를 사용하는 asp 파일들과 바이너리 파일들이 있다.

![](/assets/images/tistory/tistory-7789b9c0fa08/011.png)

cgi 파일은 httpd 프로세스 안에 내부 로직으로 구현되어 있는 것을 확인할 수 있었다.

그리고 가장 먼저 확인해주었어야 하는 친구인 rc.d 이다.

![](/assets/images/tistory/tistory-7789b9c0fa08/012.png)

해당 경로를 통해 부팅될 때 가동되는 프로세스랑 다 확인이 가능해야 하는데 필요로 하는 스크립트가 존재하지 않는다. 

추출이 정상적으로 되지 않거나 init에서 수행해버리는 것 같다.

![](/assets/images/tistory/tistory-7789b9c0fa08/013.png)

init 경로를 확인해준다.

![](/assets/images/tistory/tistory-7789b9c0fa08/014.png)

그리고 나서 스크립트들을 분석해보았는데 하드웨어 설정 및 시스템 초기화 스크립트가 대부분이며 파일 시스템이 올라가고 각종 프로세스를 실행하는 로직은 찾지 못했다.

자세한 프로세스 분석은 뒤로 하고 일단 httpd 프로세스를 살려 에뮬레이팅을 시도했다.

![](/assets/images/tistory/tistory-7789b9c0fa08/015.png)

conf 파일 복구를 위해 iptime에서 boa 스크립트를 복구했던 것처럼 찾아보았지만 httpd에서는 내부에 구현된 conf 로직을 참고하여 실행하고 있었다. 때문에 따로 복구할 필요가 없다고 판단하여 바로 프로세스를 살려보았다.

![](/assets/images/tistory/tistory-7789b9c0fa08/016.png)

```
sudo qemu-arm-static -L ./ ./usr/sbin/httpd
```

일단 오류는 크게 2종류가 발생했다.

1\. netlink 소켓 초기화 과정에서 실패했다는 메시지를 출력하는데 이는 QEMU 사용자 모드에서 netlink socket를 완전히 지원하지 않기 때문이라고 한다. 하지만 이 부분은 크게 문제가 되지 않기 때문에 무시해도 된다.

2\. httpd가 필요로 하는 80번 포트가 이미 사용중이다. 이 부분은 단순히 80번 포트를 사용중인 apache2을 중지하거나 -p 옵션을 통해 포트를 변경 후 다시 시도하면 된다.

이후 /var/run 경로를 생성 후 다시 시도해주면 된다.

![](/assets/images/tistory/tistory-7789b9c0fa08/017.png)

이러헥 하면 netlink 메시지만 뜨는 것을 볼 수 있다. 이때 웹에 접속을 시도해보면..

![](/assets/images/tistory/tistory-7789b9c0fa08/018.png)

일단 접속은 실패하고, 터미널에서는 segment fault가 발생한다.

![](/assets/images/tistory/tistory-7789b9c0fa08/019.png)

와...오ㅓㅏ....

이 부분을 해결하기 위해 strace라는 명령을 사용했다. 이 명령은 syscall이나 signal을 추적하는 명령이다.

```
sudo strace -f  chroot . ./qemu-arm-static ./usr/sbin/httpd
```

이와 같이 입력하여 로그를 출력시키고, 이를 통해 분석을 시도했다.

![](/assets/images/tistory/tistory-7789b9c0fa08/020.png)

이런식으로 추적이 가능한데, 로그를 통해 확인한 문제는 크게 2가지였다.

1\. ASUS 모델에서 사용하는 nvram 계열 함수는 하드웨어 의존성이 매우 높다는 것이다. 때문에 해당 함수들이 호출될 때 제대로 동작하지 못하고 종료된다. 

2\. 경로가 잘못되었다고 한다. iptime을 분석해볼 때와 각종 레퍼런스를 참고 했을 때 rootfs 파일 시스템의 홈 경로에서 명령을 실행해주어야 한다. 하지만 asus를 에뮬레이팅 시도하면서 로그를 보니까 해당 실행해야하는 asp 파일들을 찾지 못하고 있다.

먼저 2번 문제를 해결하기 위해 경로를 ./www/로 수정해주었다.

![](/assets/images/tistory/tistory-7789b9c0fa08/021.png)

경로를 수정하면 각종 웹 관련 파일들을 볼 수 있겠지만 다른 명령이나 conf 설정 정보 등은 불려오지 못하게 된다. 때문에 ./bin ./usr 등의 경로를 그대로 ./www 내부로 옮겨 주었다.

이후 1번 문제를 해결하기 위해 함수 후킹을 시도했다.

후킹할 함수는 nvram\_get(), nvram\_get\_init(), nvram\_set(), nvram\_unset(), nvram\_commit()이다.

해당 함수들에 대해서는 아래와 같이 c 파일을 구성했다. 특히 nvram\_get() 함수의 경우에는 값에 따라 반환해야 하는 값들이 다르기 때문에 libnvram.so 을 분석해보고 반환 값을 설정하였다.

![](/assets/images/tistory/tistory-7789b9c0fa08/022.png)

```
#define _GNU_SOURCE
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

const char* nvram_get(const char* name) {
    fprintf(stderr, "[fake_nvram] get(%s)\n", name);

    if (strcmp(name, "http_enable") == 0) return "1";
    if (strcmp(name, "login_timestamp") == 0) return "1749615239";
    if (strcmp(name, "productid") == 0) return "RT-AX57";
    if (strcmp(name, "odmpid") == 0) return "RT-AX57U";
    if (strcmp(name, "preferred_lang") == 0) return "EN";
    if (strcmp(name, "lan_ipaddr") == 0) return "192.168.1.1";
    if (strcmp(name, "lan_netmask") == 0) return "255.255.255.0";
    if (strcmp(name, "debug_cprintf") == 0) return "1";
    if (strcmp(name, "debug_cprintf_file") == 0) return "/dev/null";
    if (strcmp(name, "x_Setting") == 0) return "1";
    if (strcmp(name, "territory_code") == 0) return "US";
    if (strcmp(name, "https_lanport") == 0) return "8443";

    return "";
}

int nvram_get_int(const char* name) {
    fprintf(stderr, "[fake_nvram] get_int(%s)\n", name);

    if (strcmp(name, "HTTPD_DBG") == 0) return 0;
    if (strcmp(name, "httpd_force_lock") == 0) return 0;
    if (strcmp(name, "x_Setting") == 0) return 1;

    return 0;
}

int nvram_set(const char* name, const char* value) {
    fprintf(stderr, "[fake_nvram] set(%s, %s)\n", name, value);
    return 0;
}

int nvram_unset(const char* name) {
    fprintf(stderr, "[fake_nvram] unset(%s)\n", name);
    return 0;
}

int nvram_commit(void) {
    fprintf(stderr, "[fake_nvram] commit()\n");
    return 0;
}
```

해당 파일을 작성하고 arm으로 cross-compile을 해준다.

```
sudo apt install gcc-arm-linux-gnueabi
arm-linux-gnueabi-gcc -shared -fPIC -o libnvram_fake.so fake_nvram.c
```

이후 아래 명령을 수행한다.

```
sudo strace -f  chroot ./www/ ./qemu-arm-static -E LD_PRELOAD=./libnvram_fake.so ./usr/sbin/httpd
```

gdb를 통해 분석하고자 한다면 gdb server을 여기서 열어주면 된다.

![](/assets/images/tistory/tistory-7789b9c0fa08/023.png)

성공적으로 에뮬레이팅에 (부분)성공했다.

이에 찾아두었던 취약점 의심 코드를 검증하고 제보했었다.

![](/assets/images/tistory/tistory-7789b9c0fa08/024.png)

[https://www.asus.com/content/asus-product-security-advisory/](https://www.asus.com/content/asus-product-security-advisory/)

 [ASUS Product Security Advisory｜ASUS Global

www.asus.com](https://www.asus.com/content/asus-product-security-advisory/)

제보는 이 URL에서 해주면 된다.

이후 추가 프로세스 분석을 수행하고, 에뮬레이팅 하는 등 추가 시도를 해보고자 shell을 실행하고자 했다.

![](/assets/images/tistory/tistory-7789b9c0fa08/025.png)

흠... 근데 shell이 없고 memaccess로 대체되어 있다...

이는 ASUS 공유기 개발자용 바이너리로 루트셸을 차단하기 위함이다. 이를 우회하는 방법을 연구/분석하고 있다...

![](/assets/images/tistory/tistory-7789b9c0fa08/026.png)

그리고 에뮬레이팅을 부분적으로 성공했다고 했는데, 아직 로그인 과정이 GDB로 연결해서 값을 조정해주지 않으면 정상적으로 수행되지 않는다. 이는 조금 더 연구를 해볼 생각이다.

지금까지 분석을 시도하고 연구해오면서 얻은 것은 다음과 같다.

1\. 펌웨어 분석 방법

   1-1. 펌웨어 구조 

   1-2. 분석 절차 및 중요도

2\. 에뮬레이팅 방법

    2-1. conf 파일 복구

    2-2 . 함수 후킹

    2-3. strace를 통한 로그 분석 및 오류 접근 법

3\. 취약점 분석

    3-1. 취약점 제보 경험
