---
title: "[IPTIME] FIRMWARE ANALYZE #2"
description: "I will continue writing from #1. QEMUNow, we will analyze using the extracted files. KERNEL IMG focused on static analysis and selected emulating and analyzing ROOTFS as the next task. You may have accessed the page that appears in the window below to set up your home's WIFI or open a Minecraft server when you were young."
date: "2025-02-13"
translation_key: "tistory-e020efdb66d7"
tags: ["STUDY/FirmWare 분석(시도)"]
category: "STUDY/FirmWare 분석(시도)"
source_url: "https://whrdud727.tistory.com/entry/IPTIME-FIRMWARE-ANALYZE-2"
private: false
---

I will continue writing from #1.

### QEMU

Now, let’s analyze the extracted files.  
KERNEL IMG first focused on static analysis and selected emulating and analyzing ROOTFS as the next task.  
  

You may have accessed a page that opens a window like the one below to set up your home's WIFI or open a Minecraft server when you were young.

\[ 192.168.0.1 \]

![](/assets/images/tistory/tistory-e020efdb66d7/001.png)

Since this page is ultimately a website, a web service must be run to emulate FIRMWARE.

Normally, rc.d and rcS files exist. In this case, you can check what processes come up when the file system boots... but this friend doesn't have anything like that... I think it exists under a different name or in binary form, but I'm still working on it.

![](/assets/images/tistory/tistory-e020efdb66d7/002.png)

We looked at what commands there are to activate web services.

There are busyboxes that contain basic commands such as ls and id, commands to check the network, etc. Here, httpd can be seen as the main one. In addition to httpd, you can also see a service-related binary called servd.

![](/assets/images/tistory/tistory-e020efdb66d7/003.png)

I tried running it right away, but there were errors... Since httpd only showed config errors, I tried to solve this problem first.

Since the file name was httpd, I thought it was an httpd.conf file and tried creating the file in that path, but the same symptom occurred.

Referring to a config file means reading the config file through fopen() inside httpd. Therefore, I thought that if I dynamically analyze the binary, I would be able to check which path the file is being imported from.

I wrote a simple post about dynamic debugging using QEMU when dealing with ARCH.

[https://whrdud727.tistory.com/entry/AArch64-Debugging](https://whrdud727.tistory.com/entry/AArch64-Debugging)

 [\[AArch64\] Debugging

※ If there are any mistakes, please let us know. We will check and correct it. ※ The debugging method was mentioned earlier, but dynamic debugging cannot be performed using that method. In this post, dynamic data

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/AArch64-Debugging)

```
qemu-mipsel-static -L ~/firm/iptime/again/squashfs-root/ -g 4444 ~/firm/iptime/again/squashfs-root/sbin/httpd
```

Open gdb server on port 4444 through qemu.

Afterwards, run the command below in another terminal.

```
sudo gdb-multiarch
set arch mips:isa32
set endian little
file /home/fuzzing/firm/iptime/again/squashfs-root/sbin/httpd
target remote localhost:4444

b*0x401A54
c
```

Use mips-based arch and set it to little endian. Afterwards, connect remotely.

The 0x401A54 point where the breakpoint is set is the caller of the function that performs fopen().

![](/assets/images/tistory/tistory-e020efdb66d7/004.png)

sub\_405D04() is called with that byte\_415760 as the argument.

At this time, fopen() is performed using the byte\_415760 value received as an argument as the filename. 

To find out what is in the filename, you can call bp with fopen(), but since the same value is entered as is, I set it at that point.

Afterwards, I checked the memory...

![](/assets/images/tistory/tistory-e020efdb66d7/005.png)

Unlike AMD, which consists of existing friends such as rdi and rsi, you can see that there are registers whose names are hard to distinguish.

Here, the first argument is the a0 register with the value 0x415760.

![](/assets/images/tistory/tistory-e020efdb66d7/006.png)

The problem is simply that the data portion remains empty until fopen() is called.

While statically debugging the httpd file with IDA64 to see why, I discovered something strange.

It had a slightly different structure from httpd that I had previously seen while analyzing httpd and 1-DAY of TPLINK devices.

And since BOA was constantly mentioned internally, I installed and analyzed it myself to study BOA.

Although httpd and boa are both web-related processes, their structures are different.

However, it was strange that the structures were similar, so I looked into it and found that boa had been renamed to httpd in IPTIME....

![](/assets/images/tistory/tistory-e020efdb66d7/007.png)

Really... why... 

Then I was able to be sure that the conf file was boa.conf and not something like httpd.conf.

The problem was that there was no boa.conf file inside rootfs, but when I ran the strings command, I could see why it was not there.

When the file system is booted, the plugin\_http.so command is created due to the execution of some binary or script.

```
strigns /usr/service.plugin/plugin_http.so
```

![](/assets/images/tistory/tistory-e020efdb66d7/008.png)

The entire part of the code is as follows.

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

Through this code, you can find out the internal configuration of boa.conf, including its name format.

```
snprintf(v14, 0x80u, "/var/run/boa_vh.%d.conf", a2);
```

The boa\_vh.\[ port \].conf format is used.

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

You can check the conf file configuration,

```
  snprintf(v12, 0x80u, "httpd -s %s", v14);
  v9 = sub_13F8(v12);
  if ( v9 )
    v10 = "Error";
  else
    v10 = "OK";
  return e_log("Start httpd %s(%d)", v10, v9);
```

I was even able to find out how to run the httpd service.

Configure the conf file directly using -s, an option that does not exist in regular boa files.

Analyze the above code and execute the command below using the obtained conf file as the path.

```
sudo chroot / /usr/bin/qemu-mipsel-static /home/fuzzing/firm/iptime/again/squashfs-root/sbin/httpd -s /home/fuzzing/firm/iptime/again/squashfs-root/tmp/var/run/boa_vh.4321.conf
```

![](/assets/images/tistory/tistory-e020efdb66d7/009.png)

Although normal access to the web page was not possible, the cgi operation itself was successful as no 404 error or path not found message was displayed.I wondered if the conf file could not be properly referenced, so I checked further with dynamic debugging.

Proceed in the same way up to the point where bp was entered previously and set the memory value to an absolute path using the command below.

```
set {char[100]} 0x00415760 = "/home/fuzzing/firm/iptime/again/squashfs-root/tmp/var/run/boa_vh.7777.conf"
```

The conf file used at this time is as follows.

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

Even if you run it in this way, only a white screen appears as before, so it seems that you need to install a few other services before the httpd service starts working.

![](/assets/images/tistory/tistory-e020efdb66d7/010.png)

Analysis of CGI was also completed.  There are two paths: **/cgibin/** and **/home/httpd/**.

We discovered a number of areas that seemed vulnerable, but...

```
        msg_newline_to_br(v21, v23, 256);
        printf(v23);
        printf("</span>");
```

If you look at just one part, this is it! This is the cgi part that builds the web page, and no matter how you look at it, it looks like FSB will occur as a PWNABLE vulnerability and XSS as a WEB vulnerability!!

However, although it is not a part that receives direct input, I think there is a way...

In order to accurately analyze and check whether it actually happens, you have to emulate it or take apart your router... For this, it's time to figure out the operation order of other services and do some digging to make them work.....