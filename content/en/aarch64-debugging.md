---
title: "[AArch64] Debugging"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ The debugging method was mentioned earlier, but dynamic debugging cannot be performed using that method. In this post, we will cover how to perform dynamic debugging. (Because I am writing this based on my own experience through trial and error, there may be a more efficient method.)"
date: "2024-03-23"
translation_key: "tistory-14d4a184d653"
tags: ["STUDY/PWNABLE_AArch64"]
category: "STUDY/PWNABLE_AArch64"
source_url: "https://whrdud727.tistory.com/entry/AArch64-Debugging"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※**** 

The debugging method was mentioned earlier, but dynamic debugging cannot be performed using that method.

In this post, we will cover how to perform dynamic debugging.

(Because I am writing this based on my own experience through trial and error, there may be a more efficient method.)

* * *

[https://whrdud727.tistory.com/34](https://whrdud727.tistory.com/34)

 [\[AArch64\] x86\_64 Simple comparison

※ If there are any mistakes, please let us know. We will check and correct it. ※ This architecture is designed for efficient power use and high performance. Mainly used in environments such as smartphones and embedded systems

whrdud727.tistory.com](https://whrdud727.tistory.com/34)

First, this is the method covered in the above post.

```
gdb-multiarch -q ./a.out
```

Execute the created file using gdb-multiarch.

Since all SYMBOLs are alive here, it is easy to check and analyze the function through info func.

![](/assets/images/tistory/tistory-14d4a184d653/001.png)

* * *

To dynamically debug, you must use qemu-user-static.

```
sudo apt-get install qemu-user-static
```

Install it using the above command.

![](/assets/images/tistory/tistory-14d4a184d653/002.png)

After installation, you can see that it is installed by architecture.

```
 qemu-aarch64-static -g 1234 [binary_file_name]
```

Use the \-g option to specify the port to use. In this way, the GDB server will be run with a port number of 1234.

Afterwards, you can connect from another terminal.

```
gdb-multiarch
gef-remote --qemu-user --qemu-binary [binary_file_name] localhost 1234
```

After connecting to gdb-multiarch, use gef-remote to connect.

In this case, 1234 is the port of the GDB server opened earlier.

![](/assets/images/tistory/tistory-14d4a184d653/003.png)

After connecting like this, the Debugging window will appear.

From here, open another terminal and open another GDB in the same way as before.

```
gdb-multiarch -q ./a.out
```

In that window, check the addresses of other necessary functions, including main(), and set and analyze bp in the terminal connected to the server for dynamic debugging.

![](/assets/images/tistory/tistory-14d4a184d653/004.png)

In this way, a total of three terminals for debugging are opened and analysis is performed.

(Generally, in the remaining empty terminal window, a terminal is launched for the purpose of instantly creating and executing the payload file.)

To summarize, the method currently being used is opened and used as follows.

1\. Terminal for writing payload

2\. Static analysis terminal for addresses and information about functions/symbols

3\. terminal to open gdb-server

4\. Terminal for dynamic analysis

\[If there is a better way, please let me know;;\]