#include<bits/stdc++.h>
using namespace std;
struct node{
    int data;
    node* next;
    node* prev;
};
int main(){
    int n;
    cin >> n;
    node* head = new node();
    cin >> head->data;
    head->next = nullptr;
    head->prev = nullptr;
    node* y = head;
    for( int i = 1 ; i < n ; i++ ){
        node* temp = new node();
        cin >> temp->data;
        temp->prev = y;
        temp->next = nullptr;
        y->next = temp;
        y = temp;
    }
    n = n/2;
    int i = 0;
    node* x = head;
    bool flag = true;
    while( i <= n ){
        if( x->data != y->data ){
            flag = false;
            break;
        }
        x = x->next;
        y = y->prev;
        i++;
    }
    if( flag ) cout << "Palindrome";
    else cout << "Not Palindrome";
    return 0;
}

