---
title: "[KERNEL] Send Script to CTF"
description: "※ Since the analysis was conducted with reference to the data, there may be errors. ※ If there is anything that needs to be supplemented or corrected, please let us know and we will take action after checking. As you study Kernel exploit, a question will arise. Obviously, you need to create a binary for privilege escalation and go through the process of checking it in the local environment."
date: "2024-10-29"
translation_key: "tistory-ecef5f3635fa"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/Kernel-Send-Script-to-CTF"
private: false
---

**※ Since the analysis was conducted with reference to the data, there may be errors.** 

**※ If there is anything that needs to be supplemented or corrected, please let us know and we will check and take action.**

As you study Kernel exploit, a question will arise.

Obviously, there is a process of creating a binary to elevate privileges and checking it in the local environment, but how can it be released remotely to a place like Wargame or CTF?? 

Since I have always solved the problem by sending input values ​​through Python's pwntools, it is natural to have questions.

How do I upload the binary, access it, and unpack it?

The answer is much simpler than you think.

1\. Encode binary to base64

2\. Split the encoded data and send it to the server

3\. Decode to base64 via command to server

4\. run

There are many scripts uploaded to git to help with this process.

[https://github.com/pr0cf5/kernel-exploit-sendscript](https://github.com/pr0cf5/kernel-exploit-sendscript)

 [GitHub - pr0cf5/kernel-exploit-sendscript: A script that sends ELF files via terminal, for CTF kernel exploit probs

A script that sends ELF files via terminal, for CTF kernel exploit probs - pr0cf5/kernel-exploit-sendscript

github.com](https://github.com/pr0cf5/kernel-exploit-sendscript)

Some colleagues, including myself, use send.py from the link above.

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

Let's break down the code's operation and analyze it.

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

This is a function that submits the user’s command to the server.

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

This is a function to send a file, so let’s look at it functionally.

```
	file = read(src)
	f = b64e(file)
```

First, encode the file into base64.

```
	send_command("rm -f {}.b64".format(dst))
	send_command("rm -f {}".format(dst))
```

Check and delete any previously sent data.

```
	size = 800
	for i in range(len(f)//size + 1):
		log.info("Sending chunk {}/{}".format(i, len(f)//size))
		send_command("echo -n '{}' >> {}.b64".format(f[i*size:(i+1)*size], dst), False)
```

Transmit encoded data through the echo command. (input)

```
	send_command("cat {}.b64 | base64 -d > {}".format(dst, dst))
```

If you decode it to base64, the file will be uploaded normally.

![](/assets/images/tistory/tistory-ecef5f3635fa/001.png)

When you run send.py, the binary is uploaded through the above process.

In some cases, the output value for the input is not visible, but you can view it by using the debug mode of pwntools.