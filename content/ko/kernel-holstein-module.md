---
title: "[KERNEL] Holstein Module"
description: "※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ Holsteinhttps://whrdud727.tistory.com/entry/KERNEL-Environment-Setting [KERNEL] Environment Setting※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※"
date: "2024-06-20"
translation_key: "tistory-2904b5c93deb"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module"
private: false
---

**※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. **※****

### Holstein

* * *

[https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting](https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting)

 [\[KERNEL\] Environment Setting

※ 잘못된 부분이 있으면 알려주세요. 확인 후 수정하도록 하겠습니다. ※ https://lrl.kr/JT5m カーネルexploitへの導入 | PAWNYABLE!カーネルexploitへの導入 「ユーザーランドのpwnは一通り勉強したけ

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting)

앞서 설치한 예제에 포함된 간단한 취약점을 지닌 커널 모듈로 open, read, write를 포함하고 있다.

앞서 설치를 진행했던 설정을 가지고 진행하겠다.

취약점이 존재하는 커널 모듈은 S99pawnyable이다.

```
##
## Install driver
##
insmod /root/vuln.ko
mknod -m 666 /dev/holstein c `grep holstein /proc/devices | awk '{print $1;}'` 0
```

vuln.ko 라는 모듈을 로딩하고 holstein이라는 이름으로 mount한다.

```
##
## User shell
##
echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"
echo "[ Holstein v1 (LK01) - Pawnyable ]"
setsid cttyhack setuidgid 0 sh
```

setuidgid로 권한을 설정해주는데, 이때 0으로 설정하면 root 권한으로 실행이 가능하다.

### 분석

* * *

전체코드

더보기

#include <linux/module.h>  
#include <linux/kernel.h>  
#include <linux/cdev.h>  
#include <linux/fs.h>  
#include <linux/uaccess.h>  
#include <linux/slab.h>  
  
MODULE\_LICENSE("GPL");  
MODULE\_AUTHOR("ptr-yudai");  
MODULE\_DESCRIPTION("Holstein v1 - Vulnerable Kernel Driver for Pawnyable");  
  
#define DEVICE\_NAME "holstein"  
#define BUFFER\_SIZE 0x400  
  
char \*g\_buf = NULL;  
  
static int module\_open(struct inode \*inode, struct file \*file)  
{  
  printk(KERN\_INFO "module\_open called\\n");  
  
  g\_buf = kmalloc(BUFFER\_SIZE, GFP\_KERNEL);  
  if (!g\_buf) {  
    printk(KERN\_INFO "kmalloc failed");  
    return -ENOMEM;  
  }  
  
  return 0;  
}  
  
static ssize\_t module\_read(struct file \*file,  
                        char \_\_user \*buf, size\_t count,  
                        loff\_t \*f\_pos)  
{  
  char kbuf\[BUFFER\_SIZE\] = { 0 };  
  
  printk(KERN\_INFO "module\_read called\\n");  
  
  memcpy(kbuf, g\_buf, BUFFER\_SIZE);  
  if (\_copy\_to\_user(buf, kbuf, count)) {  
    printk(KERN\_INFO "copy\_to\_user failed\\n");  
    return -EINVAL;  
  }  
  
  return count;  
}  
  
static ssize\_t module\_write(struct file \*file,  
                            const char \_\_user \*buf, size\_t count,  
                            loff\_t \*f\_pos)  
{  
  char kbuf\[BUFFER\_SIZE\] = { 0 };  
  
  printk(KERN\_INFO "module\_write called\\n");  
  
  if (\_copy\_from\_user(kbuf, buf, count)) {  
    printk(KERN\_INFO "copy\_from\_user failed\\n");  
    return -EINVAL;  
  }  
  memcpy(g\_buf, kbuf, BUFFER\_SIZE);  
  
  return count;  
}  
  
static int module\_close(struct inode \*inode, struct file \*file)  
{  
  printk(KERN\_INFO "module\_close called\\n");  
  kfree(g\_buf);  
  return 0;  
}  
  
static struct file\_operations module\_fops =  
  {  
   .owner   = THIS\_MODULE,  
   .read    = module\_read,  
   .write   = module\_write,  
   .open    = module\_open,  
   .release = module\_close,  
  };  
  
static dev\_t dev\_id;  
static struct cdev c\_dev;  
  
static int \_\_init module\_initialize(void)  
{  
  if (alloc\_chrdev\_region(&dev\_id, 0, 1, DEVICE\_NAME)) {  
    printk(KERN\_WARNING "Failed to register device\\n");  
    return -EBUSY;  
  }  
  
  cdev\_init(&c\_dev, &module\_fops);  
  c\_dev.owner = THIS\_MODULE;  
  
  if (cdev\_add(&c\_dev, dev\_id, 1)) {  
    printk(KERN\_WARNING "Failed to add cdev\\n");  
    unregister\_chrdev\_region(dev\_id, 1);  
    return -EBUSY;  
  }  
  
  return 0;  
}  
  
static void \_\_exit module\_cleanup(void)  
{  
  cdev\_del(&c\_dev);  
  unregister\_chrdev\_region(dev\_id, 1);  
}  
  
module\_init(module\_initialize);  
module\_exit(module\_cleanup);

LK01/src/ 경로를 보면 vuln.c라는 파일이 있다.

Holstein 모듈의 소스 코드이기 때문에 이 파일을 분석해보겠다.

```
module_init(module_initialize);
module_exit(module_cleanup);
```

각각 실행 및 종료될 때 사용되는 함수이다.

```
static int __init module_initialize(void)
{
  if (alloc_chrdev_region(&dev_id, 0, 1, DEVICE_NAME)) {
    printk(KERN_WARNING "Failed to register device\n");
    return -EBUSY;
  }

  cdev_init(&c_dev, &module_fops);
  c_dev.owner = THIS_MODULE;

  if (cdev_add(&c_dev, dev_id, 1)) {
    printk(KERN_WARNING "Failed to add cdev\n");
    unregister_chrdev_region(dev_id, 1);
    return -EBUSY;
  }

  return 0;
}
```

cdev\_add()를 통해서 /dev/ 모듈을 불려와 조작할 수 있게한다.

cdev\_init()에서 module\_fops를 인자로 전달한다. 이 변수는 holstein에 대한 open, write 등의 조작이 있을 때.호출되도록 되어 있는 함수 테이블이다.

```
static struct file_operations module_fops =
 {
 .owner = THIS_MODULE,
 .read = module_read,
 .write = module_write,
 .open = module_open,
 .release = module_close,
 };
```

open, read, write, close의 4가지 경우에 대해서만 정의되어 있다.

```
static void __exit module_cleanup(void)
{
 cdev_del(&c_dev);
 unregister_chrdev_region(dev_id, 1);
}
```

마지막으로 모듈 종료 함수는 unmount, 삭제하는 기능을 가지고 있다.

```
static int module_open(struct inode *inode, struct file *file)
{
 printk(KERN_INFO "module_open called\n");

 g_buf = kmalloc(BUFFER_SIZE, GFP_KERNEL);
 if (!g_buf) {
 printk(KERN_INFO "kmalloc failed");
 return -ENOMEM;
 }

 return 0;
}
```

module이 open됐다는 커널 로그와 함께 kmalloc을 통하여  buffer에 0x400 크기의 공간을 할당해준다.

```
static int module_close(struct inode *inode, struct file *file)
{
 printk(KERN_INFO "module_close called\n");
 kfree(g_buf);
 return 0;
}
```

할당 받은 buffer를 해제하는 처리를 수행한다.

```
static ssize_t module_read(struct file *file,
 char __user *buf, size_t count,
 loff_t *f_pos)
{
 char kbuf[BUFFER_SIZE] = { 0 };

 printk(KERN_INFO "module_read called\n");

 memcpy(kbuf, g_buf, BUFFER_SIZE);
 if (_copy_to_user(buf, kbuf, count)) {
 printk(KERN_INFO "copy_to_user failed\n");
 return -EINVAL;
 }

 return count;
}
```

유저 영역에서 read syscall이 호출 되었을 경우 실행되는 함수에 해당된다.

\_copy\_to\_user()를 통해서 유저 영역의 buffer를 커널 영역의 buffer에 복사한다.

이때 복사할 데이터의 크기를 검사하지 않기 때문에 오버플로우에 취약한 함수이다.

```
static ssize_t module_write(struct file *file,
                            const char __user *buf, size_t count,
                            loff_t *f_pos)
{
  char kbuf[BUFFER_SIZE] = { 0 };

  printk(KERN_INFO "module_write called\n");

  if (_copy_from_user(kbuf, buf, count)) {
    printk(KERN_INFO "copy_from_user failed\n");
    return -EINVAL;
  }
  memcpy(g_buf, kbuf, BUFFER_SIZE);

  return count;
}
```

유저 영역에서 write syscall이 호출 되었을 경우 실행되는 함수에 해당된다.

유저 영역의 buffer에 값을 입력하고 kernel 영역의 buffer에 값을 복사한다.

### 취약점

* * *

```
static ssize_t module_write(struct file *file,
 const char __user *buf, size_t count,
 loff_t *f_pos)
{
 char kbuf[BUFFER_SIZE] = { 0 };

 printk(KERN_INFO "module_write called\n");

 if (_copy_from_user(kbuf, buf, count)) {
 printk(KERN_INFO "copy_from_user failed\n");
 return -EINVAL;
 }
 memcpy(g_buf, kbuf, BUFFER_SIZE);

 return count;
}
```

\_copy\_from\_user()에서 count는 유저 영역에서 가져온다. kbuf는 0x400의 크기를 가지고 있는데 count가 이를 넘어서는 값일 경우 stack buffer overflow 취약점이 발생하게 된다.

### Crash

* * *

```
#include <stdio.h>
#include <stdlib.h>

int main() {
    int fd = open("/dev/holstein", 2);

    char buf[0x500];
    read(fd, buf, 0x500);
    printf("buf: %s\n", buf);

    memset(buf, 'A', 0x500);
    write(fd, buf, 0x500);

    close(fd);
    return 0;
}
```

```
gcc bof_seg.c -o bof_seg -static
mv bof_seg root
cd root; find . -print0 | cpio -o --null --format=newc --owner=root > ../debugfs.cpio
cd ../
```

cpio파일을 위와 같이 다시 생성하고 스크립트를 수정해야한다.

```
qemu-system-x86_64 \
    -m 64M \
    -nographic \
    -kernel bzImage \
    -append "console=ttyS0 loglevel=3 oops=panic panic=-1 nopti nokaslr" \
    -no-reboot \
    -cpu qemu64 \
    -gdb tcp::12345 \
    -smp 1 \
    -monitor /dev/null \
    -initrd debugfs.cpio \
    -net nic,model=virtio \
    -net user
```

![](/assets/images/tistory/tistory-2904b5c93deb/001.png)

실행하면 위와 같이 Crash가 발생하는 것을 볼 수 있다.

RIP 레지스터의 값이 조작되어 Segment fualt가 발생한 것을 볼 수 있다.
