---
title: "[IPTIME] FIRMWARE ANALYZE #2"
description: "#1에 이어서 작성을 해보겠다. QEMU이제 추출한 파일들을 이용하여 분석해보겠다.KERNEL IMG는 일단 정적 분석을 메인으로 하고, ROOTFS을 에뮬레이팅하고 분석하는 것을 다음 과제로 선정했다. 집안의 WIFI 설정 혹은 어릴 때 마인크래프트 서버를 열기 위해서 아래와 같은 창이 뜨는 페이지를 접속해 보았을 것이"
date: "2025-02-13"
translation_key: "tistory-e020efdb66d7"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/IPTIME-FIRMWARE-ANALYZE-2"
private: false
---

#1에 이어서 작성을 해보겠다.

### QEMU

이제 추출한 파일들을 이용하여 분석해보겠다.  
KERNEL IMG는 일단 정적 분석을 메인으로 하고, ROOTFS을 에뮬레이팅하고 분석하는 것을 다음 과제로 선정했다.  
  

집안의 WIFI 설정 혹은 어릴 때 마인크래프트 서버를 열기 위해서 아래와 같은 창이 뜨는 페이지를 접속해 보았을 것이다.

\[ 192.168.0.1 \]

![](/assets/images/tistory/tistory-e020efdb66d7/001.png)

이 페이지도 결국은 웹 사이트이기 때문에 FIRMWARE 에뮬레이팅을 위해서는 웹 서비스를 실행해야 한다.

보통이라면 rc.d, rcS 파일이 존재한다. 이런 경우 파일 시스템이 부팅될 때 어떤 프로세스들이 올라오는지 확인이 가능한데... 이 친구는 그런게 없다... 다른 이름으로 혹은 바이너리 형태로 존재하는 거 같은데 현재 계속해서 삽질 중이다.

![](/assets/images/tistory/tistory-e020efdb66d7/002.png)

웹 서비스를 활성화하기 위해서 어떤 명령들이 있는지를 살펴보았다.

기본적인 ls, id 같은 명령들이 포함된 busybox, 네트워크 확인을 위한 명령 등등이 존재하는데 여기서 httpd를 메인으로 보면 된다. httpd 외에도 servd라고 서비스 관련 바이너리도 보인다.

![](/assets/images/tistory/tistory-e020efdb66d7/003.png)

바로 실행을 해보았는데 에러들이.... httpd에서는 config 에러만 뜨기 때문에 이 친구를 먼저 해결해보았다.

파일 이름이 httpd이기에 당연히 httpd.conf 파일인 줄 알고 파일을 임의로 해당 경로에 생성하고 해보았지만 동일한 증상이었다.

config 파일을 참조한다는 것은 httpd 내부에서 fopen()을 통해서 config 파일을 읽어온다는 것이다. 때문에 바이너리를 동적 분석을 해보면 어떤 경로에서 파일을 가져오는지 확인할 수 있을 것이라 생각했다.

QEMU를 이용해서 동적디버깅 하는 방법은 ARCH를 다룰 때 간단하게 게시글을 작성했었다.

[https://whrdud727.tistory.com/entry/AArch64-Debugging](https://whrdud727.tistory.com/entry/AArch64-Debugging)

 [\[AArch64\] Debugging

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ 디버깅하는 방법을 앞에서 언급을 했지만 해당 방법으로는 동적 디버깅을 수행할 수 없다. 이번 게시글에서는 동적 디

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/AArch64-Debugging)

```
qemu-mipsel-static -L ~/firm/iptime/again/squashfs-root/ -g 4444 ~/firm/iptime/again/squashfs-root/sbin/httpd
```

qemu를 통해 4444 port로 gdb server를 연다.

이후 아래 명령을 다른 터미널에서 실행해주면 된다.

```
sudo gdb-multiarch
set arch mips:isa32
set endian little
file /home/fuzzing/firm/iptime/again/squashfs-root/sbin/httpd
target remote localhost:4444

b*0x401A54
c
```

mips 기반 arch를 사용하도록 하고, little endian 방식으로 설정한다. 이후 remote로 접속하는 것이다.

breakpoint가 설정된 0x401A54 지점은 fopen()을 수행하는 함수의 호출자이다.

![](/assets/images/tistory/tistory-e020efdb66d7/004.png)

저 byte\_415760을 인자로 sub\_405D04()가 호출된다.

이때 인자로 받은 저 byte\_415760 값을 filename으로 하여 fopen()을 수행한다. 

해당 filename에 무엇이 있는지 알기위해서는 fopen()에 bp를 걸어도 되지만 같은 값이 그대로 들어가기에 저 지점에 설정했다.

이후 메모리를 확인해 보았는데...

![](/assets/images/tistory/tistory-e020efdb66d7/005.png)

기존의 rdi, rsi와 같은 친구들로 구성된 AMD랑은 다르게 이름도 구분이 잘 안되는 친구들이 레지스터로 있는 것을 볼 수 있다.

여기서 첫 번째 인자는 0x415760 값을 가진 a0 레지스터이다.

![](/assets/images/tistory/tistory-e020efdb66d7/006.png)

문제는 그냥 해당 데이터 부분이 fopen()을 호출할 때까지도 계속 비어있다는 것이다.

왜 그런가 하고 httpd 파일을 IDA64로 정적 디버깅해보다가 이상한 점을 발견했었다.

이전에 TPLINK 장치의 httpd와 1-DAY 분석을 하면서 봤던 httpd와는 다른 구조를 조금 띄고 있는 것이었다.

그리고 내부에서 계속해서 boa를 언급하고 있었기 때문에 boa에 대해 공부를 하고자 직접 설치를 하고 분석해보았다.

httpd와 boa 둘다 웹 관련 프로세스들이긴 하지만 구조는 달라야 한다.

근데 구조가 유사하다는 것이 이상해서 살펴보니 IPTIME에서 boa를 httpd로 이름 바꿔둔 것이었다....

![](/assets/images/tistory/tistory-e020efdb66d7/007.png)

정말... 왜 이리... 

그럼 conf 파일은 httpd.conf 같은 것이 아닌 boa.conf 인 것을 확신할 수 있었다.

문제는 rootfs 내부에 boa.conf 파일이 없었다는 것인데 strings 명령을 실행해보았을 때 왜 없는지 알 수 있었다.

파일 시스템이 부팅될 때 어떤 바이너리나 스크립트의 실행으로 인해 plugin\_http.so의 명령이 동작하는데 이때 생성된다.

```
strigns /usr/service.plugin/plugin_http.so
```

![](/assets/images/tistory/tistory-e020efdb66d7/008.png)

해당 코드의 전체 부분은 아래와 같다.

```
int __fastcall sub_147C(const char *a1, int a2)
{
  FILE *v4; // $v0
  FILE *v5; // $s0
  int max_firmware_size; // $v0
  const char *url_service_ip; // $v0
  int fakedns; // $s4
  int v9; // $v0
  const char *v10; // $a1
  char v12[256]; // [sp+20h] [-2C0h] BYREF
  char v13[256]; // [sp+120h] [-1C0h] BYREF
  char v14[128]; // [sp+220h] [-C0h] BYREF
  char v15[32]; // [sp+2A0h] [-40h] BYREF
  char v16[32]; // [sp+2C0h] [-20h] BYREF

  snprintf(v14, 0x80u, "/var/run/boa_vh.%d.conf", a2);
  strcpy(v16, "");
  get_http_auth_method(v16);
  v4 = fopen(v14, "w+");
  if ( !v4 )
  {
    fputs("Critical Error to make boa_vh.conf\n", stderr);
    goto LABEL_25;
  }
  v5 = v4;
  fprintf(v4, "Port %d\n", a2);
  fputs("User root\n", v5);
  fputs("Group root\n", v5);
  fputs("ServerAdmin root@localhost\n", v5);
  fputs("VirtualHost\n", v5);
  fputs("DocumentRoot /home/httpd\n", v5);
  fputs("UserDir public_html\n", v5);
  fputs("DirectoryIndex index.html\n", v5);
  fputs("E404 /ui/index.html\n", v5);
  fputs("KeepAliveMax 100\n", v5);
  fputs("KeepAliveTimeout 10\n", v5);
  fputs("MimeTypes /etc/mime.types\n", v5);
  fputs("DefaultType text/plain\n", v5);
  fputs("AddType application/x-httpd-cgi cgi\n", v5);
  fputs("AddType text/html html\n", v5);
  fputs("AddType image/svg+xml svg\n", v5);
  if ( !strcmp(v16, "session") )
    fprintf(v5, "ScriptAlias /sess-bin/ /%s/\n", "cgibin");
  else
    fprintf(v5, "ScriptAlias /cgi-bin/ /%s/\n", "cgibin");
  fprintf(v5, "ScriptAlias /login/ /%s/login-cgi/\n", "cgibin");
  fprintf(v5, "ScriptAlias /ddns/ /%s/ddns/\n", "cgibin");
  fputs("ScriptAlias /info/ /home/httpd/info/\n", v5);
  fputs("ServerName \"\"\n", v5);
  max_firmware_size = get_max_firmware_size();
  fprintf(v5, "SinglePostLimit %zu\n", max_firmware_size);
  if ( strcmp(v16, "session") )
  {
    fputs("Auth /cgi-bin /etc/httpd.passwd\n", v5);
    fputs("Auth /cgi /etc/httpd.passwd\n", v5);
    fputs("Auth /main /etc/httpd.passwd\n", v5);
    fputs("Auth /easymesh /etc/httpd.passwd\n", v5);
  }
  if ( !strcmp(a1, "lan") )
  {
    strcpy(v15, "");
    strcpy(v12, "");
    if ( !wl_helper_get_status() || !wl_helper_get_redirect_uri(v12, 256, v15, 32) )
    {
      if ( get_url_redirect_option() )
      {
        url_service_ip = (const char *)get_url_service_ip();
        snprintf(v15, 0x20u, "%s", url_service_ip);
        snprintf(v12, 0x100u, "http://%s:%d/login/urlredir.cgi?page=url_redirect", v15, a2);
      }
      else
      {
        fakedns = get_fakedns();
        if ( !fakedns || get_network_link("wan1") && !get_network_ip("wan1", v13) )
          goto LABEL_21;
        if ( get_ifconfig("br-lan", v15, 0) == 1 )
        {
          fputs("httpd: IF_LOCAL is not initialized yet\n", stderr);
          goto LABEL_21;
        }
        snprintf(v12, 0x100u, "http://%s:%d", v15, a2);
      }
    }
    fprintf(v5, "RedirectSrvIP %s\n", v15);
    fprintf(v5, "RedirectURI %s\n", v12);
  }
LABEL_21:
  if ( !get_ftm() && sysauth_get_cred(v13, 256) )
    fprintf(v5, "SHA256_creds %s\n", v13);
  fprintf(v5, "AuthType %s\n", v16);
  fclose(v5);
LABEL_25:
  snprintf(v12, 0x80u, "httpd -s %s", v14);
  v9 = sub_13F8(v12);
  if ( v9 )
    v10 = "Error";
  else
    v10 = "OK";
  return e_log("Start httpd %s(%d)", v10, v9);
}
```

이 코드를 통해서 boa.conf의 이름 형식을 포함한 내부 구성까지 알 수 있다.

```
snprintf(v14, 0x80u, "/var/run/boa_vh.%d.conf", a2);
```

boa\_vh.\[ port \].conf 형식을 사용하고 있다.

```
  fprintf(v4, "Port %d\n", a2);
  fputs("User root\n", v5);
  fputs("Group root\n", v5);
  fputs("ServerAdmin root@localhost\n", v5);
  fputs("VirtualHost\n", v5);

.....

    fputs("Auth /cgi /etc/httpd.passwd\n", v5);
    fputs("Auth /main /etc/httpd.passwd\n", v5);
    fputs("Auth /easymesh /etc/httpd.passwd\n", v5);
  }
```

conf 파일 구성을 확인할 수 있고,

```
  snprintf(v12, 0x80u, "httpd -s %s", v14);
  v9 = sub_13F8(v12);
  if ( v9 )
    v10 = "Error";
  else
    v10 = "OK";
  return e_log("Start httpd %s(%d)", v10, v9);
```

httpd 서비스 실행 방법까지도 알 수 있었다.

일반 boa 파일에는 없던 옵션인 -s를 사용하여 conf 파일을 직접 설정해준다.

위 코드를 분석하고 얻은 conf 파일을 경로로 하여 아래 명령을 수행한다.

```
sudo chroot / /usr/bin/qemu-mipsel-static /home/fuzzing/firm/iptime/again/squashfs-root/sbin/httpd -s /home/fuzzing/firm/iptime/again/squashfs-root/tmp/var/run/boa_vh.4321.conf
```

![](/assets/images/tistory/tistory-e020efdb66d7/009.png)

웹 페이지에 정상적인 접속은 되지 않았지만 404에러 혹은 경로를 찾을 수 없다는 메시지가 뜨지 않는 것으로 봐서는 cgi 동작 자체는 성공한 것을 볼 수 있다.

혹시 conf 파일을 제대로 참조 못하나 싶어 동적디버깅으로 추가 확인을 해보았다.

이전에 bp 건 지점까지 동일하게 진행하고 아래 명령을 통해 메모리의 값을 절대경로로 설정한다.

```
set {char[100]} 0x00415760 = "/home/fuzzing/firm/iptime/again/squashfs-root/tmp/var/run/boa_vh.7777.conf"
```

이때 사용한 conf 파일은 아래와 같다.

```
Port 7777
User root
Group root
ServerAdmin root@localhost
VirtualHost
DocumentRoot /home/fuzzing/firm/iptime/again/squashfs-root/home/httpd
UserDir public_html
DirectoryIndex index.html
KeepAliveMax 100
KeepAliveTimeout 10
MimeTypes /etc/mime.types
DefaultType text/plain
AddType application/x-httpd-cgi cgi
AddType text/html html
ScriptAlias /sess-bin/ /home/fuzzing/firm/iptime/again/squashfs-root/cgibin/
ScriptAlias /cgi-bin/ /home/fuzzing/firm/iptime/again/squashfs-root/cgibin/
ScriptAlias /nd-bin/ /home/fuzzing/firm/iptime/again/squashfs-root/ndbin/
ScriptAlias /login/ /home/fuzzing/firm/iptime/again/squashfs-root/cgibin/login-cgi/
ScriptAlias /ddns/ /home/fuzzing/firm/iptime/again/squashfs-root/cgibin/ddns/
ServerName ""
SinglePostLimit 4194304
Auth /cgi-bin /home/fuzzing/firm/iptime/again/squashfs-root/etc/httpd.passwd
Auth /main /home/fuzzing/firm/iptime/again/squashfs-root/etc/httpd.passwd
```

이런 방식으로 실행해도 이전과 동일하게 흰 화면만 뜨는 것으로 봐서는 httpd 서비스가 동작하기 전에 다른 서비스들도 몇개 올려야 되는 것 같다.

![](/assets/images/tistory/tistory-e020efdb66d7/010.png)

CGI 에대한 분석들도 완료했다.  **/cgibin/** 과 **/home/httpd/** 2개의 경로가 존재한다.

취약점이 터질 것으로 보이는 부분들을 다수 발견했지만...

```
        msg_newline_to_br(v21, v23, 256);
        printf(v23);
        printf("</span>");
```

한 부분만 살펴보면 이 부분! 웹 페이지를 구축하는 cgi 부분인데 아무리 봐도 PWNABLE 취약점으로는 FSB, WEB 취약점으로는 XSS가 발생할 것 같다!!

근데 직접적인 입력을 받는 부분은 아니지만 방법은 있을 것 같다...

정확한 분석과 실제로 터지는지 확인을 위해서는 결국 에뮬레이팅 혹은 내 라우터를 뜯어봐야 한다....   이걸 위해서는 이제 다른 서비들의 동작 순서를 알아내고 동작하게 하는 삽질을 할 시간.....
