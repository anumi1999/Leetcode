#include<bits/stdc++.h>
using namespace std;
struct node{
    int value;
    node* npx;
};
node *head = nullptr , *tail;
void insertAfter( int element ){
    node* p = new node();
    p->value = element;
    if( head == nullptr){
        p->npx = nullptr;
        head = p;
        tail = p;
    }else{
        p->npx = (node*)((uintptr_t)(tail)^(uintptr_t)(nullptr));
        tail->npx = (node*)((uintptr_t)(tail->npx) ^ (uintptr_t)p);
        tail = p;
    }
}
void printList(node *head){
    node* prev = NULL;
    node* curr = head;
    node* next;
    while( curr != nullptr){
        cout << curr->value << " -> ";
        next =(node*)((uintptr_t)(curr->npx) ^ (uintptr_t)(prev));
        prev = curr;
        curr = next;
    }
    cout << "nullptr" ;
}
int main(){

    cout << "Making: " << endl;
    for( int i = 0 ; i < 10 ; i++){
        insertAfter(i);
    }
    cout << "Printing: " << endl;
    printList(head);
    return 0;
}




