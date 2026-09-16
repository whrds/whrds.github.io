---
title: "[KERNEL] Send Script to CTF"
description: "※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다. ※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다. Kernel exploit 공부를 하다 보면 하나의 의문이 생길 것이다. 분명 권한 상승을 위한 바이너리를 제작하고, 로컬 환경에서 확인하는 과정을 거치는데 어떻"
date: "2024-10-29"
translation_key: "tistory-ecef5f3635fa"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/Kernel-Send-Script-to-CTF"
private: false
---

**※ 자료들을 참고하여 분석을 진행하였기에 잘못된 부분이 있을지도 모릅니다.** 

**※ 보완 혹은 수정해야 되는 부분이 있다면 알려주시면 확인 후 조치하도록 하겠습니다.**

Kernel exploit 공부를 하다 보면 하나의 의문이 생길 것이다.

분명 권한 상승을 위한 바이너리를 제작하고, 로컬 환경에서 확인하는 과정을 거치는데 어떻게 Wargame, CTF 와 같은 곳에 remote로 풀 수 있을까?? 

항상 python의 pwntools을 통해 입력 값들을 보내어 문제를 풀어왔기 때문에 의문이 드는 것은 당연한 것이다.

바이너리를 어떻게 업로드 하고, 접속해서 풀어야 할까?

답은 생각보다 매우 간단하다.

1\. 바이너리를 base64로 인코딩

2\. 인코딩된 데이터를 쪼개어 서버로 전송

3\. 서버에 명령을 통해 base64로 디코딩

4\. 실행

이 과정을 돕기 위한 script가 git에는 많이 업로드 되어 있다.

[https://github.com/pr0cf5/kernel-exploit-sendscript](https://github.com/pr0cf5/kernel-exploit-sendscript)

 [GitHub - pr0cf5/kernel-exploit-sendscript: A script that sends ELF files via terminal, for CTF kernel exploit probs

A script that sends ELF files via terminal, for CTF kernel exploit probs - pr0cf5/kernel-exploit-sendscript

github.com](https://github.com/pr0cf5/kernel-exploit-sendscript)

필자를 포함한 몇 동기들은 위 링크의 send.py를 사용한다.

```
#!/usr/bin/python3
from pwn import *

def send_command(cmd, print_cmd = True, print_resp = False):
	if print_cmd:
		log.info(cmd)

	p.sendlineafter("$", cmd)
	resp = p.recvuntil("$")

	if print_resp:
		log.info(resp)

	p.unrecv("$")
	return resp

def send_file(src, dst):
	file = read(src)
	f = b64e(file)

	send_command("rm -f {}.b64".format(dst))
	send_command("rm -f {}".format(dst))

	size = 800
	for i in range(len(f)//size + 1):
		log.info("Sending chunk {}/{}".format(i, len(f)//size))
		send_command("echo -n '{}' >> {}.b64".format(f[i*size:(i+1)*size], dst), False)

	send_command("cat {}.b64 | base64 -d > {}".format(dst, dst))

if __name__ == "__main__":
    if len(sys.argv) != 5:
        print("usage: ./send.py <IP> <PORT> <FILE TO SEND> <PATH ON REMOTE>")
        exit(-1)
    p = remote(sys.argv[1], int(sys.argv[2]))
    send_file(sys.argv[3], sys.argv[4])
    p.interactive()
```

코드의 동작을 쪼개어 분석해보겠다.

```
def send_command(cmd, print_cmd = True, print_resp = False):
	if print_cmd:
		log.info(cmd)

	p.sendlineafter("$", cmd)
	resp = p.recvuntil("$")

	if print_resp:
		log.info(resp)

	p.unrecv("$")
	return resp
```

서버로 user의 명령을 제출하는 함수이다.

```
def send_file(src, dst):
	file = read(src)
	f = b64e(file)

	send_command("rm -f {}.b64".format(dst))
	send_command("rm -f {}".format(dst))

	size = 800
	for i in range(len(f)//size + 1):
		log.info("Sending chunk {}/{}".format(i, len(f)//size))
		send_command("echo -n '{}' >> {}.b64".format(f[i*size:(i+1)*size], dst), False)

	send_command("cat {}.b64 | base64 -d > {}".format(dst, dst))
```

파일을 보내는 함수인데 기능적으로 살펴보겠다.

```
	file = read(src)
	f = b64e(file)
```

먼저 파일을 base64로 인코딩 한다.

```
	send_command("rm -f {}.b64".format(dst))
	send_command("rm -f {}".format(dst))
```

기존에 보내진 데이터가 있는지 확인 및 삭제한다.

```
	size = 800
	for i in range(len(f)//size + 1):
		log.info("Sending chunk {}/{}".format(i, len(f)//size))
		send_command("echo -n '{}' >> {}.b64".format(f[i*size:(i+1)*size], dst), False)
```

echo 명령을 통해서 인코딩된 데이터를 전송한다. (입력)

```
	send_command("cat {}.b64 | base64 -d > {}".format(dst, dst))
```

base64로 디코딩 해주면 파일이 정상적으로 업로드 된다.

![](/assets/images/tistory/tistory-ecef5f3635fa/001.png)

send.py를 실행하면 위와 같은 과정을 통해 바이너리가 업로드 되게 된다.

간혹 입력에 대한 출력값이 보이지 않는 경우도 있는데 pwntools의 debug 모드를 사용하면 볼 수 있다.
