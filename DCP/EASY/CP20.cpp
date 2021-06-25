#include<bits/stdc++.h>
using namespace std;
const int A_S = 26;
struct node{
    int val;
    node* next;
};

int getinter(node* head1 , node* head2 , int d){
    node* curren1 = head1;
    node* curren2 = head2;
    while( d-- ){
        curren1 = curren1->next;
    }
    while( curren1 != nullptr && curren2 != nullptr){
         if(curren1->val == curren2->val){
            return curren1->val;
         }
         curren1 = curren1->next;
         curren2 = curren2->next;
    }
    return -1;
}
int get_count(node *head){
    node* temp = head;
    int count = 0;
    while( temp != nullptr ){
        count++;
        temp = temp->next;
    }
    return count;
}
int main(){
    node* head1 = new node();
    head1->val = 10;

    node* head2 = new node();
    head2->val = 3;

    node* newNode = new node();
    newNode->val= 6;
    head2->next = newNode;

    newNode = new node();
    newNode->val = 9;
    head2->next->next = newNode;

    newNode = new node();
    newNode->val = 15;
    head1->next = newNode;
    head2->next->next->next = newNode;

    newNode = new node();
    newNode->val = 30;
    head1->next->next = newNode;

    head1->next->next->next = NULL;
    int c1 = get_count(head1);
    int c2 = get_count(head2);
    int d;

    if( c1 > c2 ){
        d = c1 - c2;
        cout << getinter(head1 , head2 , d);
    }else{
        d = c2 - c1;
        cout << getinter(head2 , head1 , d);
    }
    return 0;
}
